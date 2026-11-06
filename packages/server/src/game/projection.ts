import {
  type ClientState,
  type PlayerId,
  type PublicPlayer,
  type Role,
  type Team,
  validPlayerCounts,
} from '@ontorale/shared';
import type { Game } from './Game';

export function projectFor(game: Game, recipientId: PlayerId): ClientState {
  const me = game.getPlayer(recipientId);
  const now = game.clock.now();

  const isGameOver = game.phase === 'gameOver';
  const isMafia = me?.role === 'killer' || me?.role === 'silencer' || me?.role === 'confuser';
  const isAliveMafia = isMafia && me?.status === 'alive';

  // Public players representation
  const publicPlayers: PublicPlayer[] = game.getAllPlayers().map((p) => {
    let revealedRole: Role | null = p.revealedRole;
    if (isGameOver && p.role) {
      revealedRole = p.role;
    }

    return {
      id: p.id,
      nickname: p.nickname,
      status: p.status,
      revealedRole,
      silenced: p.silenced,
      isHost: p.isHost,
      connected: p.connected,
    };
  });

  // Mafia team visibility: alive mafia see alive teammates and their sub-roles
  let mafiaTeam: { id: PlayerId; role: Role }[] | null = null;
  if (isAliveMafia) {
    mafiaTeam = game
      .getAllPlayers()
      .filter(
        (p) =>
          p.status === 'alive' &&
          (p.role === 'killer' || p.role === 'silencer' || p.role === 'confuser'),
      )
      .map((p) => ({ id: p.id, role: p.role! }));
  }

  // Allowed targets and pending action for `me`
  const allowedTargets = me ? game.getAllowedTargets(recipientId) : [];
  const pendingAction = me ? game.getPendingAction(recipientId) : null;
  const myVote = me ? game.getPendingVote(recipientId) : null;

  // Bullets: police only
  const bullets = me?.role === 'police' ? game.policeBullets : null;

  // Investigations: detective only
  const investigations =
    me?.role === 'detective' ? game.getDetectiveInvestigations(recipientId) : [];

  // Mayor options: only for mayor during mayorTiebreak
  const mayorOptions =
    game.phase === 'mayorTiebreak' && me?.role === 'mayor' && me.status === 'alive'
      ? game.tiedCandidates
      : null;

  // All roles: only in gameOver
  let allRoles: Record<PlayerId, Role> | null = null;
  if (isGameOver) {
    allRoles = {};
    for (const p of game.getAllPlayers()) {
      if (p.role) {
        allRoles[p.id] = p.role;
      }
    }
  }

  // Compute team for `me`
  let myTeam: Team | null = null;
  if (me?.role) {
    myTeam = isMafia ? 'mafia' : 'citizens';
  }

  return {
    version: game.version,
    serverNow: now,
    roomCode: game.roomCode,
    phase: game.phase,
    round: game.round,
    phaseEndsAt: game.phaseEndsAt,
    settings: game.settings,
    players: publicPlayers,
    me: {
      id: recipientId,
      role: me?.role ?? null,
      team: myTeam,
      alive: me?.status === 'alive',
      isHost: me?.isHost ?? false,
      bullets,
      mafiaTeam,
      pendingAction,
      allowedTargets,
      myVote,
      investigations,
      mayorOptions,
    },
    log: game.log,
    voteResult: game.publishedVoteResult,
    validPlayerCounts: validPlayerCounts(game.settings.optional),
    winner: game.winner,
    allRoles,
  };
}
