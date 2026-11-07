import type { Role, Team, ActionKind } from './types';
import { isMafiaRole, teamForRole } from './roles';

export interface AbilityDef {
  id: string;
  role: Role;
  team: Team;
  actionKind: ActionKind;
  disableable: boolean;
  lifetimeLimit?: number;
  cooldownRounds?: number;
}

export interface AbilityState {
  used: Record<string, number>;
  cooldownUntilRound: Record<string, number>;
  disabledUntilRound: number;
}

export const isAbilityAvailable = (s: AbilityState, a: AbilityDef, round: number): boolean =>
  (!a.lifetimeLimit || (s.used[a.id] ?? 0) < a.lifetimeLimit) &&
  round >= (s.cooldownUntilRound[a.id] ?? 0) &&
  !(a.disableable && s.disabledUntilRound > 0 && round <= s.disabledUntilRound);

export const ABILITIES: Record<string, AbilityDef> = {
  kill: {
    id: 'kill',
    role: 'killer',
    team: 'mafia',
    actionKind: 'kill',
    disableable: false, // Killer's kill cannot be disabled per owner confirmation
  },
  protect: {
    id: 'protect',
    role: 'doctor',
    team: 'citizens',
    actionKind: 'protect',
    disableable: true,
  },
  policeShoot: {
    id: 'policeShoot',
    role: 'police',
    team: 'citizens',
    actionKind: 'shoot',
    disableable: true,
  },
  habildarShoot: {
    id: 'habildarShoot',
    role: 'habildar',
    team: 'citizens',
    actionKind: 'shoot',
    disableable: true,
    lifetimeLimit: 1,
  },
  habildarDisable: {
    id: 'habildarDisable',
    role: 'habildar',
    team: 'citizens',
    actionKind: 'disable',
    disableable: true,
    cooldownRounds: 1,
  },
  investigate: {
    id: 'investigate',
    role: 'detective',
    team: 'citizens',
    actionKind: 'investigate',
    disableable: true,
    lifetimeLimit: 2,
  },
  stalk: {
    id: 'stalk',
    role: 'stalker',
    team: 'mafia',
    actionKind: 'stalk',
    disableable: true,
    lifetimeLimit: 1,
  },
  silence: {
    id: 'silence',
    role: 'silencer',
    team: 'mafia',
    actionKind: 'silence',
    disableable: true,
  },
  confuse: {
    id: 'confuse',
    role: 'confuser',
    team: 'mafia',
    actionKind: 'confuse',
    disableable: true,
  },
};

export function getAbilityForRoleAndAction(
  role: Role,
  actionKind: ActionKind,
): AbilityDef | undefined {
  return Object.values(ABILITIES).find((a) => a.role === role && a.actionKind === actionKind);
}

export function hasDisableableAbility(role: Role): boolean {
  return Object.values(ABILITIES).some((a) => a.role === role && a.disableable);
}

export { isMafiaRole, teamForRole };
