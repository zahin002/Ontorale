import { describe, it, expect } from 'vitest';
import {
  buildRoleList,
  validPlayerCounts,
  shuffle,
  assignRoles,
  MAFIA_COUNT,
  type Rng,
} from './roles';
import type { OptionalRoles, Role } from './types';

// Deterministic LCG pseudo-random number generator for testing
function createSeededRng(seed = 123456789): Rng {
  let s = seed;
  return {
    int(maxExclusive: number): number {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s % maxExclusive;
    },
  };
}

const baseOpt: OptionalRoles = {
  detective: false,
  mayor: false,
  habildar: false,
  silencer: false,
  confuser: false,
  stalker: false,
};

describe('roles module', () => {
  // ROLE-01: Exhaustive check for n ∈ 6..15 and all 64 optional combinations (Section 10)
  it('ROLE-01: validates role distribution for all n ∈ 6..15 and all 64 optional combos', () => {
    const booleanOptions = [false, true];

    for (let n = 6; n <= 15; n++) {
      for (const detective of booleanOptions) {
        for (const mayor of booleanOptions) {
          for (const habildar of booleanOptions) {
            for (const silencer of booleanOptions) {
              for (const confuser of booleanOptions) {
                for (const stalker of booleanOptions) {
                  const opt: OptionalRoles = {
                    detective,
                    mayor,
                    habildar,
                    silencer,
                    confuser,
                    stalker,
                  };
                  const result = buildRoleList(n, opt);

                  const expectedMafiaTotal = MAFIA_COUNT[n];
                  const optMafiaCount = Number(silencer) + Number(confuser) + Number(stalker);
                  const minKillers = expectedMafiaTotal >= 2 ? 2 : 1;
                  const expectedKillers = expectedMafiaTotal - optMafiaCount;

                  if (expectedKillers < minKillers) {
                    expect(result).toEqual({ error: 'roleConfigInvalid' });
                  } else {
                    expect(Array.isArray(result)).toBe(true);
                    const roles = result as Role[];
                    expect(roles.length).toBe(n);

                    // Exactly 1 doctor and 1 police
                    expect(roles.filter((r) => r === 'doctor').length).toBe(1);
                    expect(roles.filter((r) => r === 'police').length).toBe(1);

                    // Optional citizen roles
                    expect(roles.filter((r) => r === 'detective').length).toBe(detective ? 1 : 0);
                    expect(roles.filter((r) => r === 'mayor').length).toBe(mayor ? 1 : 0);
                    expect(roles.filter((r) => r === 'habildar').length).toBe(habildar ? 1 : 0);

                    // Mafia composition
                    expect(roles.filter((r) => r === 'killer').length).toBe(expectedKillers);
                    expect(roles.filter((r) => r === 'silencer').length).toBe(silencer ? 1 : 0);
                    expect(roles.filter((r) => r === 'confuser').length).toBe(confuser ? 1 : 0);
                    expect(roles.filter((r) => r === 'stalker').length).toBe(stalker ? 1 : 0);

                    const totalMafia = roles.filter(
                      (r) =>
                        r === 'killer' ||
                        r === 'silencer' ||
                        r === 'confuser' ||
                        r === 'stalker',
                    ).length;
                    expect(totalMafia).toBe(expectedMafiaTotal);
                    expect(roles.filter((r) => r === 'citizen').length).toBeGreaterThanOrEqual(0);
                  }
                }
              }
            }
          }
        }
      }
    }
  });

  // Out of bounds player count check
  it('rejects invalid player count outside 6..15', () => {
    expect(buildRoleList(5, baseOpt)).toEqual({ error: 'playerCountInvalid' });
    expect(buildRoleList(16, baseOpt)).toEqual({ error: 'playerCountInvalid' });
  });

  // ROLE-02: Specific error cases
  it('ROLE-02: enforces error cases for invalid mafia optional role configurations', () => {
    const twoMafiaOpt: OptionalRoles = {
      ...baseOpt,
      silencer: true,
      confuser: true,
    };
    const silencerOnly: OptionalRoles = {
      ...baseOpt,
      silencer: true,
    };
    const confuserOnly: OptionalRoles = {
      ...baseOpt,
      confuser: true,
    };
    const stalkerOnly: OptionalRoles = {
      ...baseOpt,
      stalker: true,
    };

    // Any mafia-optional role with n ∈ {6, 7, 8, 9} (mafia = 1 or 2, killers must be >= 1 or >= 2)
    for (const n of [6, 7, 8, 9]) {
      expect(buildRoleList(n, silencerOnly)).toEqual({ error: 'roleConfigInvalid' });
      expect(buildRoleList(n, confuserOnly)).toEqual({ error: 'roleConfigInvalid' });
      expect(buildRoleList(n, stalkerOnly)).toEqual({ error: 'roleConfigInvalid' });
    }

    // Two mafia-optional roles with n ∈ {6, 7, 8, 9, 10, 11}
    // (at 10-11, mafia=3, minKillers=2 => only 1 opt allowed)
    for (let n = 6; n < 12; n++) {
      expect(buildRoleList(n, twoMafiaOpt)).toEqual({ error: 'roleConfigInvalid' });
    }
  });

  // validPlayerCounts
  it('validPlayerCounts correctly filters counts based on optional roles', () => {
    const defaultOpt: OptionalRoles = {
      ...baseOpt,
      detective: true,
      mayor: true,
    };
    expect(validPlayerCounts(defaultOpt)).toEqual([6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);

    const twoMafiaOpt: OptionalRoles = {
      ...baseOpt,
      silencer: true,
      confuser: true,
    };
    // 2 mafia optional roles require 4 mafia total => n in 12..15
    expect(validPlayerCounts(twoMafiaOpt)).toEqual([12, 13, 14, 15]);

    const oneMafiaOpt: OptionalRoles = {
      ...baseOpt,
      silencer: true,
    };
    // 1 mafia optional requires 3 mafia total => n in 10..15
    expect(validPlayerCounts(oneMafiaOpt)).toEqual([10, 11, 12, 13, 14, 15]);
  });

  // ROLE-03: shuffle determinism and permutation; assignRoles assigns each id once
  it('ROLE-03: shuffle is a deterministic permutation and assignRoles assigns each player exactly one role', () => {
    const rng1 = createSeededRng(42);
    const rng2 = createSeededRng(42);

    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const shuf1 = shuffle(arr, rng1);
    const shuf2 = shuffle(arr, rng2);

    // Deterministic with same seed
    expect(shuf1).toEqual(shuf2);

    // Permutation of original array
    expect([...shuf1].sort((a, b) => a - b)).toEqual(arr);

    // assignRoles test
    const players = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'];
    const opt: OptionalRoles = {
      ...baseOpt,
      detective: true,
      mayor: true,
    };

    const assigned = assignRoles(players, opt, createSeededRng(99));
    expect('error' in assigned).toBe(false);

    const assignedMap = assigned as Record<string, Role>;
    expect(Object.keys(assignedMap).sort()).toEqual(players.sort());

    const assignedRolesList = Object.values(assignedMap);
    expect(assignedRolesList.length).toBe(6);
    expect(assignedRolesList).toContain('doctor');
    expect(assignedRolesList).toContain('police');
    expect(assignedRolesList).toContain('killer');

    // assignRoles returns error when invalid config
    const invalidAssigned = assignRoles(players, { ...opt, silencer: true }, createSeededRng(99));
    expect(invalidAssigned).toEqual({ error: 'roleConfigInvalid' });
  });
});
