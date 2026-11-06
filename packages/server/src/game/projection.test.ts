import { describe, it, expect } from 'vitest';
import { Game } from './Game';
import { FakeClock } from './clock';
import { projectFor } from './projection';
import type { Phase, Role } from '@ontorale/shared';

describe('PROJ-01: Projection leak test', () => {
  const allPhases: Phase[] = [
    'lobby',
    'night',
    'nightResult',
    'discussion',
    'voting',
    'mayorTiebreak',
    'voteResult',
    'gameOver',
  ];

  it('PROJ-01: ensures no living player role is leaked to unauthorized recipients in any phase', () => {
    const roles: Role[] = [
      'citizen',
      'doctor',
      'police',
      'detective',
      'mayor',
      'killer',
      'silencer',
      'confuser',
      'citizen',
      'killer',
      'citizen',
      'citizen',
    ];

    const clock = new FakeClock();
    const game = new Game({
      roomCode: 'PROJ01',
      clock,
      timerScale: 1,
    });

    const addedPlayers = roles.map((_, i) => {
      const res = game.addPlayer(`Player_${i + 1}`, i === 0);
      if ('error' in res) throw new Error(res.error);
      return res.player;
    });

    // Directly assign unique roles to players
    addedPlayers.forEach((p, idx) => {
      p.role = roles[idx];
      p.status = 'alive';
    });

    for (const phase of allPhases) {
      game.phase = phase;

      for (const recipient of addedPlayers) {
        const state = projectFor(game, recipient.id);
        const serialized = JSON.stringify(state);

        // Check against every other living player
        for (const other of addedPlayers) {
          if (other.id === recipient.id) continue;

          const isRecipientMafia =
            recipient.role === 'killer' ||
            recipient.role === 'silencer' ||
            recipient.role === 'confuser';

          const isOtherMafia =
            other.role === 'killer' || other.role === 'silencer' || other.role === 'confuser';

          if (phase === 'gameOver') {
            // In gameOver, all roles are revealed publicly
            expect(serialized).toContain(`"${other.role}"`);
          } else if (isRecipientMafia && isOtherMafia) {
            // Alive mafia see alive mafia teammates
            expect(state.me.mafiaTeam).toBeDefined();
            const teammate = state.me.mafiaTeam?.find((m) => m.id === other.id);
            expect(teammate?.role).toBe(other.role);
          } else {
            // Non-mafia OR mafia looking at a non-mafia player:
            // The other living player's role MUST NOT appear anywhere associated with that player!
            const otherPublic = state.players.find((p) => p.id === other.id);
            expect(otherPublic?.revealedRole).toBeNull();

            // Verify police bullets not leaked to anyone other than police
            if (other.role === 'police' && recipient.role !== 'police') {
              expect(state.me.bullets).toBeNull();
            }

            // Verify detective investigations not leaked to anyone other than detective
            if (recipient.role !== 'detective') {
              expect(state.me.investigations).toEqual([]);
            }

            // Verify mayor options not leaked to anyone other than mayor
            if (recipient.role !== 'mayor') {
              expect(state.me.mayorOptions).toBeNull();
            }
          }
        }
      }
    }
  });

  it('reveals role on death/elimination/disconnect during the game', () => {
    const clock = new FakeClock();
    const game = new Game({ roomCode: 'DEATH1', clock });

    const p1 = game.addPlayer('P1', true);
    const p2 = game.addPlayer('P2', false);
    if ('error' in p1 || 'error' in p2) throw new Error();

    p1.player.role = 'doctor';
    p2.player.role = 'citizen';
    game.phase = 'night';

    // Before death: p1 role is secret from p2
    let p2State = projectFor(game, p2.player.id);
    expect(p2State.players.find((p) => p.id === p1.player.id)?.revealedRole).toBeNull();

    // Mark p1 dead with revealed role
    p1.player.status = 'dead';
    p1.player.revealedRole = 'doctor';

    // After death: p1 role is publicly revealed
    p2State = projectFor(game, p2.player.id);
    expect(p2State.players.find((p) => p.id === p1.player.id)?.revealedRole).toBe('doctor');
  });
});
