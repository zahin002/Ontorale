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

describe('roles module', () => {
  // ROLE-01: Exhaustive check for n ∈ 6..15 and all 16 optional combinations
  it('ROLE-01: validates role distribution for all n ∈ 6..15 and all 16 optional combos', () => {
    const booleanOptions = [false, true];

    for (let n = 6; n <= 15; n++) {
      for (const detective of booleanOptions) {
        for (const silencer of booleanOptions) {
          for (const confuser of booleanOptions) {
            for (const mayor of booleanOptions) {
              const opt: OptionalRoles = { detective, silencer, confuser, mayor };
              const result = buildRoleList(n, opt);

              const expectedMafiaTotal = MAFIA_COUNT[n];
              const optMafiaCount = Number(silencer) + Number(confuser);
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

                // Mafia composition
                expect(roles.filter((r) => r === 'killer').length).toBe(expectedKillers);
                expect(roles.filter((r) => r === 'silencer').length).toBe(silencer ? 1 : 0);
                expect(roles.filter((r) => r === 'confuser').length).toBe(confuser ? 1 : 0);

                const totalMafia = roles.filter(
                  (r) => r === 'killer' || r === 'silencer' || r === 'confuser',
                ).length;
                expect(totalMafia).toBe(expectedMafiaTotal);
              }
            }
          }
        }
      }
    }
  });

  // Out of bounds player count check
  it('rejects invalid player count outside 6..15', () => {
    const defaultOpt: OptionalRoles = {
      detective: false,
      silencer: false,
      confuser: false,
      mayor: false,
    };
    expect(buildRoleList(5, defaultOpt)).toEqual({ error: 'playerCountInvalid' });
    expect(buildRoleList(16, defaultOpt)).toEqual({ error: 'playerCountInvalid' });
  });

  // ROLE-02: Specific error cases
  it('ROLE-02: enforces error cases for invalid mafia optional role configurations', () => {
    const bothMafiaOpt: OptionalRoles = {
      detective: false,
      mayor: false,
      silencer: true,
      confuser: true,
    };
    const silencerOnly: OptionalRoles = {
      detective: false,
      mayor: false,
      silencer: true,
      confuser: false,
    };
    const confuserOnly: OptionalRoles = {
      detective: false,
      mayor: false,
      silencer: false,
      confuser: true,
    };

    // silencer + confuser with n < 12
    for (let n = 6; n < 12; n++) {
      expect(buildRoleList(n, bothMafiaOpt)).toEqual({ error: 'roleConfigInvalid' });
    }

    // any mafia-optional role with n ∈ {6, 7, 8, 9}
    for (const n of [6, 7, 8, 9]) {
      expect(buildRoleList(n, silencerOnly)).toEqual({ error: 'roleConfigInvalid' });
      expect(buildRoleList(n, confuserOnly)).toEqual({ error: 'roleConfigInvalid' });
    }

    // both silencer and confuser with n ∈ {10, 11}
    for (const n of [10, 11]) {
      expect(buildRoleList(n, bothMafiaOpt)).toEqual({ error: 'roleConfigInvalid' });
    }
  });

  // validPlayerCounts
  it('validPlayerCounts correctly filters counts based on optional roles', () => {
    const defaultOpt: OptionalRoles = {
      detective: true,
      mayor: true,
      silencer: false,
      confuser: false,
    };
    expect(validPlayerCounts(defaultOpt)).toEqual([6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);

    const bothMafiaOpt: OptionalRoles = {
      detective: true,
      mayor: true,
      silencer: true,
      confuser: true,
    };
    expect(validPlayerCounts(bothMafiaOpt)).toEqual([12, 13, 14, 15]);

    const oneMafiaOpt: OptionalRoles = {
      detective: true,
      mayor: true,
      silencer: true,
      confuser: false,
    };
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
      detective: true,
      mayor: true,
      silencer: false,
      confuser: false,
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

