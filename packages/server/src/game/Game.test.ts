import { describe, it, expect } from 'vitest';
import { Game } from './Game';
import { FakeClock } from './clock';

function setupGameWithRoles(
  playerCount = 6,
  discussionSec: 180 | 240 = 180,
  voteSec: 30 | 60 = 60,
) {
  const clock = new FakeClock();
  const game = new Game({
    roomCode: 'TEST01',
    clock,
    timerScale: 1,
  });

  game.settings.discussionSec = discussionSec;
  game.settings.voteSec = voteSec;

  const players = [];
  for (let i = 1; i <= playerCount; i++) {
    const res = game.addPlayer(`Player${i}`, i === 1);
    if ('error' in res) throw new Error(res.error);
    players.push(res.player);
  }

  return { game, clock, players };
}

describe('GAME State Machine & Rules', () => {
  // GAME-01: Phase order and exact durations, stale timer ignored, night never ends early
  it('GAME-01: verifies phase order and exact durations with FakeClock', () => {
    const { game, clock, players } = setupGameWithRoles(6, 180, 60);

    // Manual deterministic roles: 1 killer, 1 police, 1 doctor, 1 mayor, 2 citizens
    players[0].role = 'killer';
    players[1].role = 'police';
    players[2].role = 'doctor';
    players[3].role = 'mayor';
    players[4].role = 'citizen';
    players[5].role = 'citizen';

    // Start night round 1
    game.phase = 'lobby';
    game.round = 1;
    game.enterPhase('night');

    expect(game.phase).toBe('night');
    expect(game.phaseEndsAt).toBe(clock.now() + 120_000);

    // Night never ends early even if all actions are in
    game.submitAction(players[0].id, 'kill', null); // abstain so all survive to vote
    game.submitAction(players[1].id, 'shoot', null);
    game.submitAction(players[2].id, 'protect', players[2].id);

    clock.advanceBy(60_000); // 60s passed
    expect(game.phase).toBe('night'); // still night!

    clock.advanceBy(60_000); // 120s passed: night resolves
    expect(game.phase).toBe('nightResult');
    expect(game.phaseEndsAt).toBe(clock.now() + 10_000);

    clock.advanceBy(10_000); // 10s passed
    expect(game.phase).toBe('discussion');
    expect(game.phaseEndsAt).toBe(clock.now() + 180_000);

    clock.advanceBy(180_000); // 180s passed
    expect(game.phase).toBe('voting');
    expect(game.phaseEndsAt).toBe(clock.now() + 60_000);

    // Create a tie between players[4] and players[5] to trigger mayorTiebreak
    game.castVote(players[0].id, players[4].id);
    game.castVote(players[1].id, players[5].id);

    clock.advanceBy(60_000); // 60s passed
    expect(game.phase).toBe('mayorTiebreak');
    expect(game.phaseEndsAt).toBe(clock.now() + 20_000);

    // Mayor chooses players[4]
    game.mayorDecide(players[3].id, players[4].id);
    expect(game.phase).toBe('voteResult');
    expect(game.phaseEndsAt).toBe(clock.now() + 10_000);

    clock.advanceBy(10_000); // 10s passed: moves to next night
    expect(game.phase).toBe('night');
    expect(game.round).toBe(2);
  });

  it('GAME-01: stale timer is ignored when phase is manually advanced early', () => {
    const { game, clock } = setupGameWithRoles(6);
    game.enterPhase('night');
    expect(game.phase).toBe('night');

    // Manually force transition to discussion before night timer finishes
    game.enterPhase('discussion');
    expect(game.phase).toBe('discussion');

    // Advance to when the previous night timer would have fired (120s)
    clock.advanceBy(120_000);
    // Since phaseToken changed, stale timer callback is ignored
    expect(game.phase).toBe('discussion');
  });

  // GAME-02: Disconnect cases
  it('GAME-02: killer disconnects discards picks; last mafia disconnect ends game', () => {
    const { game, players } = setupGameWithRoles(6);
    players[0].role = 'killer';
    players[1].role = 'killer';
    players[2].role = 'doctor';
    players[3].role = 'police';
    players[4].role = 'citizen';
    players[5].role = 'citizen';

    game.enterPhase('night');

    // Killer 1 picks target, then disconnects
    game.submitAction(players[0].id, 'kill', players[4].id);
    expect(game.getPendingAction(players[0].id)).toEqual({ kind: 'kill', target: players[4].id });

    game.handleMidGameDisconnect(players[0].id);
    expect(game.getPendingAction(players[0].id)).toBeNull(); // picks discarded
    expect(players[0].status).toBe('disconnected');
    expect(players[0].revealedRole).toBe('killer');

    // Game continues because Killer 2 is still alive
    expect(game.phase).toBe('night');

    // Killer 2 disconnects: last mafia disconnected -> citizens win immediately!
    game.handleMidGameDisconnect(players[1].id);
    expect(game.phase).toBe('gameOver');
    expect(game.winner).toBe('citizens');
  });

  it('GAME-02: mayor disconnect during tiebreak resolves to nobody', () => {
    const { game, players } = setupGameWithRoles(6);
    players[0].role = 'mayor';
    players[1].role = 'citizen';
    players[2].role = 'citizen';
    players[3].role = 'killer';
    players[4].role = 'killer';
    players[5].role = 'citizen';

    game.phase = 'mayorTiebreak';
    game.tiedCandidates = [players[1].id, players[2].id];

    game.handleMidGameDisconnect(players[0].id); // Mayor disconnects
    // Resolves to nobody and transitions to voteResult
    expect(game.phase).toBe('voteResult');
    expect(game.tiedCandidates).toBeNull();
    expect(players[1].status).toBe('alive');
    expect(players[2].status).toBe('alive');
  });

  it('GAME-02: lobby disconnect handles host transfer', () => {
    const { game, players } = setupGameWithRoles(3);
    expect(players[0].isHost).toBe(true);

    const { destroyed, newHostId } = game.removePlayer(players[0].id);
    expect(destroyed).toBe(false);
    expect(newHostId).toBe(players[1].id);
    expect(players[1].isHost).toBe(true);
  });

  // GAME-03: Silence covers the next day discussion and voting
  it('GAME-03: silence covers next day discussion and voting; silenced player may vote', () => {
    const { game, clock, players } = setupGameWithRoles(6);
    players[0].role = 'killer';
    players[1].role = 'silencer';
    players[2].role = 'citizen';
    players[3].role = 'citizen';
    players[4].role = 'citizen';
    players[5].role = 'citizen';

    game.enterPhase('night');
    // Silencer targets player 2
    game.submitAction(players[1].id, 'silence', players[2].id);

    // Night ends
    clock.advanceBy(120_000);
    expect(game.phase).toBe('nightResult');
    expect(players[2].silenced).toBe(true);

    clock.advanceBy(10_000);
    expect(game.phase).toBe('discussion');
    expect(players[2].silenced).toBe(true);

    clock.advanceBy(180_000);
    expect(game.phase).toBe('voting');
    expect(players[2].silenced).toBe(true);

    // Silenced player is allowed to vote
    const voteRes = game.castVote(players[2].id, players[0].id);
    expect(voteRes).toEqual({ ok: true });
    expect(game.getPendingVote(players[2].id)).toBe(players[0].id);
  });

  // GAME-04: Police bullets: 2 total, third shot rejected, bullets lost when police dies
  it('GAME-04: police bullets limit (2 total) and death behavior', () => {
    const { game, clock, players } = setupGameWithRoles(6);
    players[0].role = 'police';
    players[1].role = 'killer';
    players[2].role = 'citizen';
    players[3].role = 'citizen';
    players[4].role = 'citizen';
    players[5].role = 'citizen';

    expect(game.policeBullets).toBe(2);

    // Shot 1
    game.round = 1;
    game.enterPhase('night');
    game.submitAction(players[0].id, 'shoot', players[2].id);
    clock.advanceBy(120_000);
    expect(game.policeBullets).toBe(1);

    // Move to next night
    clock.advanceBy(10_000); // nightResult
    clock.advanceBy(180_000); // discussion
    clock.advanceBy(60_000); // voting
    clock.advanceBy(10_000); // voteResult -> night round 2
    expect(game.phase).toBe('night');
    expect(game.round).toBe(2);

    // Shot 2
    game.submitAction(players[0].id, 'shoot', players[3].id);
    clock.advanceBy(120_000);
    expect(game.policeBullets).toBe(0);

    // Move to next night round 3
    clock.advanceBy(10_000);
    clock.advanceBy(180_000);
    clock.advanceBy(60_000);
    clock.advanceBy(10_000);
    expect(game.phase).toBe('night');
    expect(game.round).toBe(3);

    // Third shot rejected with noBullets
    const thirdShot = game.submitAction(players[0].id, 'shoot', players[4].id);
    expect(thirdShot).toEqual({ error: 'noBullets' });

    // When police dies: bullets lost and cannot act
    players[0].status = 'dead';
    const deadShot = game.submitAction(players[0].id, 'shoot', players[4].id);
    expect(deadShot).toEqual({ error: 'notAllowed' });
  });

  it('handles rematch flow and role abilities (doctor save, confuser inversion)', () => {
    const { game, clock, players } = setupGameWithRoles(6);
    players[0].role = 'killer';
    players[1].role = 'doctor';
    players[2].role = 'detective';
    players[3].role = 'confuser';
    players[4].role = 'citizen';
    players[5].role = 'citizen';

    game.round = 1;
    game.enterPhase('night');

    // Killer attacks citizen 4
    game.submitAction(players[0].id, 'kill', players[4].id);
    // Doctor protects citizen 4 (save!)
    game.submitAction(players[1].id, 'protect', players[4].id);
    // Detective investigates citizen 4
    game.submitAction(players[2].id, 'investigate', players[4].id);
    // Confuser confuses citizen 4 (inverts detective result: citizen -> mafia!)
    game.submitAction(players[3].id, 'confuse', players[4].id);

    clock.advanceBy(120_000); // night ends
    expect(game.phase).toBe('nightResult');
    expect(players[4].status).toBe('alive'); // saved!

    // Detective saw 'mafia' for citizen 4 because confuser inverted it
    const invs = game.getDetectiveInvestigations(players[2].id);
    expect(invs).toHaveLength(1);
    expect(invs[0].result).toBe('mafia');

    // Fast-forward to gameOver
    game.phase = 'gameOver';
    game.winner = 'citizens';

    // Disconnect one player to test rematch cleanup (D21)
    players[5].connected = false;
    players[5].status = 'disconnected';

    // Host triggers rematch
    const rematchRes = game.rematch(players[0].id);
    expect(rematchRes).toEqual({ ok: true });
    expect(game.phase).toBe('lobby');
    expect(game.round).toBe(0);
    expect(game.winner).toBeNull();
    // Disconnected player 5 removed from room
    expect(game.getPlayer(players[5].id)).toBeUndefined();
  });

  it('Stalker has 1 lifetime check limit and ability is exhausted after 1 use', () => {
    const { game, players } = setupGameWithRoles(6);
    const stalker = players[0];
    const citizen = players[1];
    stalker.role = 'stalker';
    citizen.role = 'citizen';
    game.phase = 'night';
    game.round = 1;

    // Initially has 1 remaining
    const statusBefore = game.getPlayerAbilityStatus(stalker.id);
    expect(statusBefore?.stalk?.remaining).toBe(1);

    // Allowed targets returns citizen
    const targets = game.getAllowedTargets(stalker.id);
    expect(targets).toContain(citizen.id);

    // Submit stalk action
    const submitRes = game.submitAction(stalker.id, 'stalk', citizen.id);
    expect(submitRes).toEqual({ ok: true });

    // Mark stalk used
    const abilityState = game.getAbilityState(stalker.id);
    abilityState.used['stalk'] = 1;

    // Now remaining is 0
    const statusAfter = game.getPlayerAbilityStatus(stalker.id);
    expect(statusAfter?.stalk?.remaining).toBe(0);

    // Targets is now empty
    const targetsAfter = game.getAllowedTargets(stalker.id);
    expect(targetsAfter).toHaveLength(0);

    // Submitting again fails with limitReached
    const secondSubmit = game.submitAction(stalker.id, 'stalk', citizen.id);
    expect(secondSubmit).toEqual({ error: 'limitReached' });
  });

  it('Constable disable: targets any alive player except self; disables special abilities; silent no-effect on Citizen/Killer with identical cooldown', () => {
    const { game, players } = setupGameWithRoles(6);
    const constable = players[0];
    const doctor = players[1];
    const killer = players[2];
    const citizen = players[3];
    const mayor = players[4];

    constable.role = 'habildar';
    doctor.role = 'doctor';
    killer.role = 'killer';
    citizen.role = 'citizen';
    mayor.role = 'mayor';

    game.phase = 'night';
    game.round = 1;

    // Self-target rejected
    const selfRes = game.submitAction(constable.id, 'disable', constable.id);
    expect(selfRes).toEqual({ error: 'invalidTarget' });

    // Targeting Doctor (Citizen with disableable ability) is allowed
    const docRes = game.submitAction(constable.id, 'disable', doctor.id);
    expect(docRes).toEqual({ ok: true });

    // Allowed targets returns all alive other players
    const allowed = game.getAllowedTargets(constable.id);
    expect(allowed).toContain(doctor.id);
    expect(allowed).toContain(killer.id);
    expect(allowed).toContain(citizen.id);
    expect(allowed).toContain(mayor.id);
    expect(allowed).not.toContain(constable.id);

    // Resolve night with Constable disabling Doctor
    (game as unknown as { resolveNightPhase: () => void }).resolveNightPhase();

    // Doctor is disabled until round 3 (round 1 + 2)
    const docAbility = game.getAbilityState(doctor.id);
    expect(docAbility.disabledUntilRound).toBe(3);

    // Constable cooldown is round 3
    const conAbility = game.getAbilityState(constable.id);
    expect(conAbility.cooldownUntilRound['disable']).toBe(3);

    // In round 2, Doctor is disabled and cannot protect
    game.round = 2;
    game.phase = 'night';
    const docSubmitDisabled = game.submitAction(doctor.id, 'protect', citizen.id);
    expect(docSubmitDisabled).toEqual({ error: 'abilityUnavailable' });
    expect(game.getAllowedTargets(doctor.id)).toHaveLength(0);

    // Test targeting Killer / Citizen in next night (when cooldown expires at round 3)
    game.round = 3;
    const conAbility3 = game.getAbilityState(constable.id);
    conAbility3.cooldownUntilRound['disable'] = 0; // ready
    const targetKillerRes = game.submitAction(constable.id, 'disable', killer.id);
    expect(targetKillerRes).toEqual({ ok: true });

    // Night resolution: Killer has no disableable ability, so killer disabledUntilRound stays 0
    (game as unknown as { resolveNightPhase: () => void }).resolveNightPhase();
    const killerState = game.getAbilityState(killer.id);
    expect(killerState.disabledUntilRound).toBe(0); // silent no-effect
    // But Constable still gets cooldown applied
    expect(conAbility3.cooldownUntilRound['disable']).toBe(5);
  });
});
