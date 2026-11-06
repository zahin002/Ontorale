import { describe, it, expect } from 'vitest';
import { resolveNight, type NightPlayer, type NightActions } from './night';
import type { Role } from './types';

const P = (id: string, role: Role, alive = true): NightPlayer => ({ id, role, alive });
const baseActions: NightActions = {
  killerPicks: {},
  doctorProtect: null,
  policeShot: null,
  detectiveTarget: null,
  confuserTarget: null,
  silencerTarget: null,
};

describe('resolveNight - NIGHT-01 suite', () => {
  // (a) two killers same target dies
  it('NIGHT-01(a): two killers same target dies', () => {
    const players = [P('k1', 'killer'), P('k2', 'killer'), P('c1', 'citizen')];
    const actions: NightActions = {
      ...baseActions,
      killerPicks: { k1: 'c1', k2: 'c1' },
    };
    const outcome = resolveNight(players, actions, 0);
    expect(outcome.deaths).toEqual([{ id: 'c1', causes: ['mafia'] }]);
    expect(outcome.mafiaCancelled).toBe(false);
  });

  // (b) one killer picks, other abstains dies
  it('NIGHT-01(b): one killer picks, other abstains dies', () => {
    const players = [P('k1', 'killer'), P('k2', 'killer'), P('c1', 'citizen')];
    const actions: NightActions = {
      ...baseActions,
      killerPicks: { k1: 'c1', k2: null },
    };
    const outcome = resolveNight(players, actions, 0);
    expect(outcome.deaths).toEqual([{ id: 'c1', causes: ['mafia'] }]);
    expect(outcome.mafiaCancelled).toBe(false);
  });

  // (c) different targets => nobody dies, mafiaCancelled
  it('NIGHT-01(c): different targets => nobody dies, mafiaCancelled', () => {
    const players = [P('k1', 'killer'), P('k2', 'killer'), P('c1', 'citizen'), P('c2', 'citizen')];
    const actions: NightActions = {
      ...baseActions,
      killerPicks: { k1: 'c1', k2: 'c2' },
    };
    const outcome = resolveNight(players, actions, 0);
    expect(outcome.deaths).toEqual([]);
    expect(outcome.mafiaCancelled).toBe(true);
  });

  // (d) all abstain
  it('NIGHT-01(d): all killers abstain => no mafia target', () => {
    const players = [P('k1', 'killer'), P('k2', 'killer'), P('c1', 'citizen')];
    const actions: NightActions = {
      ...baseActions,
      killerPicks: { k1: null, k2: null },
    };
    const outcome = resolveNight(players, actions, 0);
    expect(outcome.deaths).toEqual([]);
    expect(outcome.mafiaCancelled).toBe(false);
  });

  // (e) three killers with two different picks cancelled
  it('NIGHT-01(e): three killers with two different picks cancelled', () => {
    const players = [
      P('k1', 'killer'),
      P('k2', 'killer'),
      P('k3', 'killer'),
      P('c1', 'citizen'),
      P('c2', 'citizen'),
    ];
    const actions: NightActions = {
      ...baseActions,
      killerPicks: { k1: 'c1', k2: 'c2', k3: 'c1' },
    };
    const outcome = resolveNight(players, actions, 0);
    expect(outcome.deaths).toEqual([]);
    expect(outcome.mafiaCancelled).toBe(true);
  });

  // (f) doctor saves from mafia
  it('NIGHT-01(f): doctor saves from mafia', () => {
    const players = [P('k1', 'killer'), P('d', 'doctor'), P('c1', 'citizen')];
    const actions: NightActions = {
      ...baseActions,
      killerPicks: { k1: 'c1' },
      doctorProtect: 'c1',
    };
    const outcome = resolveNight(players, actions, 0);
    expect(outcome.deaths).toEqual([]);
    expect(outcome.saves).toEqual([{ id: 'c1', from: 'mafia' }]);
  });

  // (g) doctor saves from police and the bullet is still spent
  it('NIGHT-01(g): doctor saves from police and the bullet is still spent', () => {
    const players = [P('p', 'police'), P('d', 'doctor'), P('c1', 'citizen')];
    const actions: NightActions = {
      ...baseActions,
      policeShot: 'c1',
      doctorProtect: 'c1',
    };
    const outcome = resolveNight(players, actions, 2);
    expect(outcome.deaths).toEqual([]);
    expect(outcome.bulletsSpent).toBe(1);
    expect(outcome.saves).toEqual([{ id: 'c1', from: 'police' }]);
  });

  // (h) doctor self-protect vs police shot
  it('NIGHT-01(h): doctor self-protect vs police shot', () => {
    const players = [P('p', 'police'), P('d', 'doctor')];
    const actions: NightActions = {
      ...baseActions,
      policeShot: 'd',
      doctorProtect: 'd',
    };
    const outcome = resolveNight(players, actions, 1);
    expect(outcome.deaths).toEqual([]);
    expect(outcome.bulletsSpent).toBe(1);
    expect(outcome.saves).toEqual([{ id: 'd', from: 'police' }]);
  });

  // (i) police shoots mafia dies
  it('NIGHT-01(i): police shoots mafia dies', () => {
    const players = [P('p', 'police'), P('k1', 'killer')];
    const actions: NightActions = {
      ...baseActions,
      policeShot: 'k1',
    };
    const outcome = resolveNight(players, actions, 2);
    expect(outcome.deaths).toEqual([{ id: 'k1', causes: ['police'] }]);
    expect(outcome.bulletsSpent).toBe(1);
  });

  // (j) police shoots doctor who protected self survives
  it('NIGHT-01(j): police shoots doctor who protected self survives', () => {
    const players = [P('p', 'police'), P('d', 'doctor')];
    const actions: NightActions = {
      ...baseActions,
      policeShot: 'd',
      doctorProtect: 'd',
    };
    const outcome = resolveNight(players, actions, 2);
    expect(outcome.deaths).toEqual([]);
    expect(outcome.saves).toEqual([{ id: 'd', from: 'police' }]);
    expect(outcome.bulletsSpent).toBe(1);
  });

  // (k) mafia kills police and police shoots mafia: both die
  it('NIGHT-01(k): mafia kills police and police shoots mafia: both die', () => {
    const players = [P('k1', 'killer'), P('p', 'police')];
    const actions: NightActions = {
      ...baseActions,
      killerPicks: { k1: 'p' },
      policeShot: 'k1',
    };
    const outcome = resolveNight(players, actions, 1);
    expect(outcome.deaths.map((d) => d.id).sort()).toEqual(['k1', 'p']);
    expect(outcome.bulletsSpent).toBe(1);
  });

  // (l) same victim by both attacks dies once with two causes
  it('NIGHT-01(l): same victim by both attacks dies once with two causes', () => {
    const players = [P('k1', 'killer'), P('p', 'police'), P('c1', 'citizen')];
    const actions: NightActions = {
      ...baseActions,
      killerPicks: { k1: 'c1' },
      policeShot: 'c1',
    };
    const outcome = resolveNight(players, actions, 2);
    expect(outcome.deaths).toEqual([{ id: 'c1', causes: ['mafia', 'police'] }]);
    expect(outcome.bulletsSpent).toBe(1);
  });

  // (m) both attacks on the protected player: two saves
  it('NIGHT-01(m): both attacks on the protected player: two saves', () => {
    const players = [P('k1', 'killer'), P('p', 'police'), P('d', 'doctor'), P('c1', 'citizen')];
    const actions: NightActions = {
      ...baseActions,
      killerPicks: { k1: 'c1' },
      policeShot: 'c1',
      doctorProtect: 'c1',
    };
    const outcome = resolveNight(players, actions, 2);
    expect(outcome.deaths).toEqual([]);
    expect(outcome.saves).toEqual([
      { id: 'c1', from: 'mafia' },
      { id: 'c1', from: 'police' },
    ]);
    expect(outcome.bulletsSpent).toBe(1);
  });

  // (n) police with 0 bullets cannot shoot
  it('NIGHT-01(n): police with 0 bullets cannot shoot', () => {
    const players = [P('p', 'police'), P('k1', 'killer')];
    const actions: NightActions = {
      ...baseActions,
      policeShot: 'k1',
    };
    const outcome = resolveNight(players, actions, 0);
    expect(outcome.deaths).toEqual([]);
    expect(outcome.bulletsSpent).toBe(0);
  });

  // (o) silencer target killed the same night is not silenced
  it('NIGHT-01(o): silencer target killed the same night is not silenced', () => {
    const players = [P('k1', 'killer'), P('s1', 'silencer'), P('c1', 'citizen')];
    const actions: NightActions = {
      ...baseActions,
      killerPicks: { k1: 'c1' },
      silencerTarget: 'c1',
    };
    const outcome = resolveNight(players, actions, 0);
    expect(outcome.deaths).toEqual([{ id: 'c1', causes: ['mafia'] }]);
    expect(outcome.silenced).toBeNull();
  });

  // silencer target surviving is silenced
  it('silencer target who survives is silenced', () => {
    const players = [
      P('k1', 'killer'),
      P('s1', 'silencer'),
      P('c1', 'citizen'),
      P('c2', 'citizen'),
    ];
    const actions: NightActions = {
      ...baseActions,
      killerPicks: { k1: 'c1' },
      silencerTarget: 'c2',
    };
    const outcome = resolveNight(players, actions, 0);
    expect(outcome.deaths).toEqual([{ id: 'c1', causes: ['mafia'] }]);
    expect(outcome.silenced).toBe('c2');
  });

  // (p) detective result for each of the 8 roles
  it('NIGHT-01(p): detective result for each of the 8 roles', () => {
    const allRoles: Role[] = [
      'citizen',
      'doctor',
      'police',
      'detective',
      'mayor',
      'killer',
      'silencer',
      'confuser',
    ];

    for (const targetRole of allRoles) {
      const players = [P('det', 'detective'), P('target', targetRole)];
      const actions: NightActions = {
        ...baseActions,
        detectiveTarget: 'target',
      };
      const outcome = resolveNight(players, actions, 0);
      const isMafia =
        targetRole === 'killer' || targetRole === 'silencer' || targetRole === 'confuser';
      expect(outcome.investigation).toEqual({
        target: 'target',
        result: isMafia ? 'mafia' : 'notMafia',
      });
    }
  });

  // (q) confuser inverts for citizen and for mafia, and only for its own target
  it('NIGHT-01(q): confuser inverts for citizen and for mafia, and only for its own target', () => {
    // 1. Confuser on citizen: detective sees 'mafia'
    const playersCitizen = [P('det', 'detective'), P('conf', 'confuser'), P('c1', 'citizen')];
    const outcomeCitizen = resolveNight(
      playersCitizen,
      {
        ...baseActions,
        detectiveTarget: 'c1',
        confuserTarget: 'c1',
      },
      0,
    );
    expect(outcomeCitizen.investigation).toEqual({ target: 'c1', result: 'mafia' });

    // 2. Confuser on mafia killer: detective sees 'notMafia'
    const playersMafia = [P('det', 'detective'), P('conf', 'confuser'), P('k1', 'killer')];
    const outcomeMafia = resolveNight(
      playersMafia,
      {
        ...baseActions,
        detectiveTarget: 'k1',
        confuserTarget: 'k1',
      },
      0,
    );
    expect(outcomeMafia.investigation).toEqual({ target: 'k1', result: 'notMafia' });
  });

  // (r) confuser targeting someone else does not affect the detective
  it('NIGHT-01(r): confuser targeting someone else does not affect the detective', () => {
    const players = [
      P('det', 'detective'),
      P('conf', 'confuser'),
      P('c1', 'citizen'),
      P('k1', 'killer'),
    ];
    // Detective investigates citizen c1, confuser targeted k1
    const outcome = resolveNight(
      players,
      {
        ...baseActions,
        detectiveTarget: 'c1',
        confuserTarget: 'k1',
      },
      0,
    );
    expect(outcome.investigation).toEqual({ target: 'c1', result: 'notMafia' });
  });

  // (s) killer/police acting while dying the same night still act
  it('NIGHT-01(s): killer/police acting while dying the same night still act', () => {
    const players = [P('k1', 'killer'), P('p', 'police')];
    const actions: NightActions = {
      ...baseActions,
      killerPicks: { k1: 'p' },
      policeShot: 'k1',
    };
    const outcome = resolveNight(players, actions, 1);
    expect(outcome.deaths.map((d) => d.id).sort()).toEqual(['k1', 'p']);
    expect(outcome.bulletsSpent).toBe(1);
  });

  // (t) dead players' actions ignored
  it('NIGHT-01(t): dead players actions are ignored', () => {
    const players = [
      P('k1', 'killer', false), // dead killer
      P('k2', 'killer', true), // alive killer
      P('p', 'police', false), // dead police
      P('d', 'doctor', false), // dead doctor
      P('c1', 'citizen', true),
    ];
    const actions: NightActions = {
      ...baseActions,
      killerPicks: { k1: 'c1', k2: null }, // dead killer tries to shoot, alive killer abstains
      policeShot: 'c1', // dead police
      doctorProtect: 'c1', // dead doctor
    };
    const outcome = resolveNight(players, actions, 2);
    // Since k1 is dead, its pick is ignored. Alive killer k2 picked null. So no mafia kill.
    // Since police is dead, shot is ignored.
    expect(outcome.deaths).toEqual([]);
    expect(outcome.saves).toEqual([]);
    expect(outcome.bulletsSpent).toBe(0);
  });

  // Edge cases: targeting self for police, silencer, detective
  it('ignores invalid self targets for police, silencer, detective and dead targets', () => {
    const players = [
      P('p', 'police'),
      P('s', 'silencer'),
      P('det', 'detective'),
      P('dead', 'citizen', false),
    ];
    const actions: NightActions = {
      ...baseActions,
      policeShot: 'p', // self shoot not allowed
      silencerTarget: 's', // self silence not allowed
      detectiveTarget: 'det', // self investigate not allowed
    };
    const outcome = resolveNight(players, actions, 2);
    expect(outcome.bulletsSpent).toBe(0);
    expect(outcome.silenced).toBeNull();
    expect(outcome.investigation).toBeNull();

    // Dead targets
    const actionsDead: NightActions = {
      ...baseActions,
      policeShot: 'dead',
      silencerTarget: 'dead',
      detectiveTarget: 'dead',
      doctorProtect: 'dead',
    };
    const outcomeDead = resolveNight(players, actionsDead, 2);
    expect(outcomeDead.bulletsSpent).toBe(0);
    expect(outcomeDead.silenced).toBeNull();
    expect(outcomeDead.investigation).toBeNull();
  });

  // v1.1 Habildar, Stalker, Disabled abilities, and Teammate targeting tests
  describe('v1.1 New Roles and Abilities', () => {
    it('Habildar shoot resolves like Police shot, spends bullet, doctor can save', () => {
      const players = [P('h', 'habildar'), P('c', 'citizen'), P('d', 'doctor')];
      const actions: NightActions = {
        ...baseActions,
        habildarAction: { kind: 'shoot', targetId: 'c' },
      };
      const outcome = resolveNight(players, actions, 0, 1);
      expect(outcome.deaths).toEqual([{ id: 'c', causes: ['police'] }]);
      expect(outcome.habildarBulletsSpent).toBe(1);

      // Doctor saves from Habildar shot
      const savedOutcome = resolveNight(
        players,
        { ...actions, doctorProtect: 'c' },
        0,
        1,
      );
      expect(savedOutcome.deaths).toEqual([]);
      expect(savedOutcome.saves).toEqual([{ id: 'c', from: 'police' }]);
      expect(savedOutcome.habildarBulletsSpent).toBe(1);
    });

    it('Habildar disable sets disabledTarget for mafia target, rejects citizen target', () => {
      const players = [P('h', 'habildar'), P('k', 'killer'), P('c', 'citizen')];
      // Target mafia
      const outcomeMafia = resolveNight(
        players,
        { ...baseActions, habildarAction: { kind: 'disable', targetId: 'k' } },
        0,
        0,
      );
      expect(outcomeMafia.disabledTarget).toBe('k');

      // Target citizen
      const outcomeCitizen = resolveNight(
        players,
        { ...baseActions, habildarAction: { kind: 'disable', targetId: 'c' } },
        0,
        0,
      );
      expect(outcomeCitizen.disabledTarget).toBeNull();
    });

    it('Disabled mafia roles (silencer, confuser, stalker) do not execute their actions; killer kill cannot be disabled', () => {
      const disabledKiller: NightPlayer = { id: 'k', role: 'killer', alive: true, disabled: true };
      const disabledSilencer: NightPlayer = { id: 's', role: 'silencer', alive: true, disabled: true };
      const disabledConfuser: NightPlayer = { id: 'cf', role: 'confuser', alive: true, disabled: true };
      const disabledStalker: NightPlayer = { id: 'st', role: 'stalker', alive: true, disabled: true };
      const det: NightPlayer = { id: 'd', role: 'detective', alive: true };
      const citizen: NightPlayer = { id: 'c', role: 'citizen', alive: true };

      const players = [disabledKiller, disabledSilencer, disabledConfuser, disabledStalker, det, citizen];
      const actions: NightActions = {
        killerPicks: { k: 'c' },
        doctorProtect: null,
        policeShot: null,
        detectiveTarget: 'cf',
        confuserTarget: 'c',
        silencerTarget: 'c',
        stalkerTarget: 'c',
      };

      const outcome = resolveNight(players, actions, 0, 0);
      expect(outcome.deaths).toEqual([{ id: 'c', causes: ['mafia'] }]);
      expect(outcome.silenced).toBeNull(); // Disabled silencer does not silence
      expect(outcome.stalkResult).toBeNull(); // Disabled stalker does not check
      // Detective checks disabled confuser (who is mafia) => result is mafia (confuser didn't frame)
      expect(outcome.investigation?.result).toBe('mafia');
    });

    it('Stalker reveals exact role id of Citizen target', () => {
      const players = [P('st', 'stalker'), P('doc', 'doctor'), P('k', 'killer')];
      // Stalk doctor
      const outcomeDoc = resolveNight(
        players,
        { ...baseActions, stalkerTarget: 'doc' },
        0,
        0,
      );
      expect(outcomeDoc.stalkResult).toEqual({ target: 'doc', role: 'doctor' });

      // Stalking mafia is invalid
      const outcomeMafia = resolveNight(
        players,
        { ...baseActions, stalkerTarget: 'k' },
        0,
        0,
      );
      expect(outcomeMafia.stalkResult).toBeNull();
    });

    it('Silencer and Confuser can target teammates', () => {
      const players = [P('s', 'silencer'), P('cf', 'confuser'), P('k', 'killer'), P('det', 'detective')];
      // Silencer silences teammate killer, confuser frames teammate killer
      const outcome = resolveNight(
        players,
        {
          ...baseActions,
          silencerTarget: 'k',
          confuserTarget: 'k',
          detectiveTarget: 'k',
        },
        0,
        0,
      );
      expect(outcome.silenced).toBe('k');
      // Confuser frames teammate killer: killer is mafia, framed => notMafia
      expect(outcome.investigation?.result).toBe('notMafia');
    });
  });
});
