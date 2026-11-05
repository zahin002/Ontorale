import type { PlayerId, Role, Cause } from './types';

export interface NightPlayer {
  id: PlayerId;
  role: Role;
  alive: boolean;
}

export interface NightActions {
  killerPicks: Record<PlayerId, PlayerId | null>; // keyed by killer id
  doctorProtect: PlayerId | null;
  policeShot: PlayerId | null;
  detectiveTarget: PlayerId | null;
  confuserTarget: PlayerId | null;
  silencerTarget: PlayerId | null;
}

export type { Cause };

export interface NightOutcome {
  deaths: { id: PlayerId; causes: Cause[] }[];
  saves: { id: PlayerId; from: Cause }[];
  silenced: PlayerId | null;
  investigation: { target: PlayerId; result: 'mafia' | 'notMafia' } | null;
  bulletsSpent: 0 | 1;
  mafiaCancelled: boolean; // internal only; NEVER sent to clients
}

export const isMafiaRole = (r: Role) => r === 'killer' || r === 'silencer' || r === 'confuser';

export function resolveNight(
  players: NightPlayer[],
  a: NightActions,
  bullets: number,
): NightOutcome {
  const byId = new Map(players.map((p) => [p.id, p]));
  const alive = (id: PlayerId | null | undefined): id is PlayerId =>
    !!id && byId.get(id)?.alive === true;
  const actor = (role: Role) => players.find((p) => p.alive && p.role === role);

  const picks = players
    .filter((p) => p.alive && p.role === 'killer')
    .map((k) => a.killerPicks[k.id] ?? null)
    .filter((t): t is PlayerId => alive(t));

  let mafiaTarget: PlayerId | null = null;
  let mafiaCancelled = false;
  if (picks.length > 0) {
    if (picks.every((t) => t === picks[0])) mafiaTarget = picks[0];
    else mafiaCancelled = true;
  }

  const police = actor('police');
  let policeTarget: PlayerId | null = null;
  let bulletsSpent: 0 | 1 = 0;
  if (police && bullets > 0 && alive(a.policeShot) && a.policeShot !== police.id) {
    policeTarget = a.policeShot;
    bulletsSpent = 1;
  }

  const doctor = actor('doctor');
  const protectedId = doctor && alive(a.doctorProtect) ? a.doctorProtect : null;

  const attacks: { target: PlayerId; cause: Cause }[] = [];
  if (mafiaTarget) attacks.push({ target: mafiaTarget, cause: 'mafia' });
  if (policeTarget) attacks.push({ target: policeTarget, cause: 'police' });

  const deathMap = new Map<PlayerId, Cause[]>();
  const saves: { id: PlayerId; from: Cause }[] = [];
  for (const at of attacks) {
    if (protectedId === at.target) saves.push({ id: at.target, from: at.cause });
    else deathMap.set(at.target, [...(deathMap.get(at.target) ?? []), at.cause]);
  }

  let silenced: PlayerId | null = null;
  const silencer = actor('silencer');
  const st = a.silencerTarget;
  if (silencer && alive(st) && st !== silencer.id && !deathMap.has(st)) silenced = st;

  let investigation: NightOutcome['investigation'] = null;
  const det = actor('detective');
  const dt = a.detectiveTarget;
  if (det && alive(dt) && dt !== det.id) {
    const truth = isMafiaRole(byId.get(dt)!.role);
    const confused = !!actor('confuser') && a.confuserTarget === dt;
    investigation = { target: dt, result: truth !== confused ? 'mafia' : 'notMafia' };
  }

  return {
    deaths: [...deathMap].map(([id, causes]) => ({ id, causes })),
    saves,
    silenced,
    investigation,
    bulletsSpent,
    mafiaCancelled,
  };
}
