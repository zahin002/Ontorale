import { MAFIA_COUNT } from './constants';
import type { OptionalRoles, Role, PlayerId, Team } from './types';

export { MAFIA_COUNT };

export interface Rng {
  int(maxExclusive: number): number;
}

export const isMafiaRole = (r: Role): boolean =>
  r === 'killer' || r === 'silencer' || r === 'confuser' || r === 'stalker';

export const isCitizenRole = (r: Role): boolean => !isMafiaRole(r);

export const teamForRole = (r: Role): Team => (isMafiaRole(r) ? 'mafia' : 'citizens');

export function buildRoleList(
  n: number,
  opt: OptionalRoles,
): Role[] | { error: 'playerCountInvalid' | 'roleConfigInvalid' } {
  const mafia = MAFIA_COUNT[n];
  if (mafia === undefined) return { error: 'playerCountInvalid' };
  const optMafia =
    Number(Boolean(opt.silencer)) +
    Number(Boolean(opt.confuser)) +
    Number(Boolean(opt.stalker));
  const killers = mafia - optMafia;
  const minKillers = mafia >= 2 ? 2 : 1;
  if (killers < minKillers) return { error: 'roleConfigInvalid' };
  const roles: Role[] = ['doctor', 'police'];
  if (opt.detective) roles.push('detective');
  if (opt.mayor) roles.push('mayor');
  if (opt.habildar) roles.push('habildar');
  for (let i = 0; i < killers; i++) roles.push('killer');
  if (opt.silencer) roles.push('silencer');
  if (opt.confuser) roles.push('confuser');
  if (opt.stalker) roles.push('stalker');
  if (roles.length > n) return { error: 'roleConfigInvalid' };
  while (roles.length < n) roles.push('citizen');
  return roles; // length === n always
}

export function validPlayerCounts(opt: OptionalRoles): number[] {
  return Object.keys(MAFIA_COUNT)
    .map(Number)
    .filter((n) => !('error' in (buildRoleList(n, opt) as object)));
}

export function shuffle<T>(arr: readonly T[], rng: Rng): T[] {
  // Fisher-Yates
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function assignRoles(
  ids: PlayerId[],
  opt: OptionalRoles,
  rng: Rng,
): Record<PlayerId, Role> | { error: string } {
  const list = buildRoleList(ids.length, opt);
  if ('error' in list) return list;
  const shuffled = shuffle(list, rng);
  return Object.fromEntries(ids.map((id, i) => [id, shuffled[i]]));
}
