import type { PlayerId, Role, Cause } from './types';
import { isMafiaRole } from './roles';

export interface NightPlayer {
  id: PlayerId;
  role: Role;
  alive: boolean;
  disabled?: boolean;
}

export interface NightActions {
  killerPicks: Record<PlayerId, PlayerId | null>; // keyed by killer id
  doctorProtect: PlayerId | null;
  policeShot: PlayerId | null;
  detectiveTarget: PlayerId | null;
  confuserTarget: PlayerId | null;
  silencerTarget: PlayerId | null;
  habildarAction?: { kind: 'shoot' | 'disable' | 'skip'; targetId: PlayerId | null } | null;
  stalkerTarget?: PlayerId | null;
}

export type { Cause };

export interface NightOutcome {
  deaths: { id: PlayerId; causes: Cause[] }[];
  saves: { id: PlayerId; from: Cause }[];
  silenced: PlayerId | null;
  investigation: { target: PlayerId; result: 'mafia' | 'notMafia' } | null;
  stalkResult?: { target: PlayerId; role: Role } | null;
  disabledTarget?: PlayerId | null;
  bulletsSpent: 0 | 1;
  habildarBulletsSpent?: 0 | 1;
  mafiaCancelled: boolean; // internal only; NEVER sent to clients
}

export { isMafiaRole };

export function resolveNight(
  players: NightPlayer[],
  a: NightActions,
  policeBullets: number,
  habildarBullets: number = 0,
): NightOutcome {
  const byId = new Map(players.map((p) => [p.id, p]));
  const alive = (id: PlayerId | null | undefined): id is PlayerId =>
    !!id && byId.get(id)?.alive === true;
  const actor = (role: Role) => players.find((p) => p.alive && p.role === role);

  // Killer picks - note: killer kill is NOT disableable per user confirmation
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

  // Police shot
  const police = actor('police');
  let policeTarget: PlayerId | null = null;
  let bulletsSpent: 0 | 1 = 0;
  if (police && policeBullets > 0 && alive(a.policeShot) && a.policeShot !== police.id) {
    policeTarget = a.policeShot;
    bulletsSpent = 1;
  }

  // Habildar shot or disable
  const habildar = actor('habildar');
  let habildarShootTarget: PlayerId | null = null;
  let habildarBulletsSpent: 0 | 1 = 0;
  let disabledTarget: PlayerId | null = null;

  if (habildar && a.habildarAction) {
    if (
      a.habildarAction.kind === 'shoot' &&
      habildarBullets > 0 &&
      alive(a.habildarAction.targetId) &&
      a.habildarAction.targetId !== habildar.id
    ) {
      habildarShootTarget = a.habildarAction.targetId;
      habildarBulletsSpent = 1;
    } else if (
      a.habildarAction.kind === 'disable' &&
      !habildar.disabled &&
      alive(a.habildarAction.targetId) &&
      a.habildarAction.targetId !== habildar.id
    ) {
      const targetPlayer = byId.get(a.habildarAction.targetId);
      if (targetPlayer && isMafiaRole(targetPlayer.role)) {
        disabledTarget = targetPlayer.id;
      }
    }
  }

  // Doctor protect
  const doctor = actor('doctor');
  const protectedId = doctor && alive(a.doctorProtect) ? a.doctorProtect : null;

  // Attacks
  const attacks: { target: PlayerId; cause: Cause }[] = [];
  if (mafiaTarget) attacks.push({ target: mafiaTarget, cause: 'mafia' });
  if (policeTarget) attacks.push({ target: policeTarget, cause: 'police' });
  if (habildarShootTarget) attacks.push({ target: habildarShootTarget, cause: 'police' });

  const deathMap = new Map<PlayerId, Cause[]>();
  const saves: { id: PlayerId; from: Cause }[] = [];
  for (const at of attacks) {
    if (protectedId === at.target) saves.push({ id: at.target, from: at.cause });
    else deathMap.set(at.target, [...(deathMap.get(at.target) ?? []), at.cause]);
  }

  // Silence: Silencer can target ANY alive player except self (Citizen or Mafia).
  // If Silencer is disabled, does not silence.
  let silenced: PlayerId | null = null;
  const silencer = actor('silencer');
  const st = a.silencerTarget;
  if (
    silencer &&
    !silencer.disabled &&
    alive(st) &&
    st !== silencer.id &&
    !deathMap.has(st)
  ) {
    silenced = st;
  }

  // Detective: If Detective is disabled, does not investigate.
  // Confuser (Framer): Can target ANY alive player (Citizen or Mafia).
  // If Confuser is disabled, does not confuse.
  let investigation: NightOutcome['investigation'] = null;
  const det = actor('detective');
  const dt = a.detectiveTarget;
  if (det && !det.disabled && alive(dt) && dt !== det.id) {
    const truth = isMafiaRole(byId.get(dt)!.role);
    const confuser = actor('confuser');
    const confused = !!confuser && !confuser.disabled && a.confuserTarget === dt;
    investigation = { target: dt, result: truth !== confused ? 'mafia' : 'notMafia' };
  }

  // Stalker: If Stalker is disabled, does not check.
  // Target must be alive Citizen-team player.
  let stalkResult: NightOutcome['stalkResult'] = null;
  const stalker = actor('stalker');
  const stalkTarget = a.stalkerTarget;
  if (
    stalker &&
    !stalker.disabled &&
    alive(stalkTarget) &&
    stalkTarget !== stalker.id
  ) {
    const targetPlayer = byId.get(stalkTarget);
    if (targetPlayer && !isMafiaRole(targetPlayer.role)) {
      stalkResult = { target: stalkTarget, role: targetPlayer.role };
    }
  }

  return {
    deaths: [...deathMap].map(([id, causes]) => ({ id, causes })),
    saves,
    silenced,
    investigation,
    stalkResult,
    disabledTarget,
    bulletsSpent,
    habildarBulletsSpent,
    mafiaCancelled,
  };
}
