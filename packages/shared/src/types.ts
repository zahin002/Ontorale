export type PlayerId = string;

export type Role =
  'citizen' | 'doctor' | 'police' | 'detective' | 'mayor' | 'killer' | 'silencer' | 'confuser';

export type Team = 'citizens' | 'mafia';

export type Phase =
  | 'lobby'
  | 'night'
  | 'nightResult'
  | 'discussion'
  | 'voting'
  | 'mayorTiebreak'
  | 'voteResult'
  | 'gameOver';

export type WinMode = 'plusOne' | 'examples' | 'parity';

export interface OptionalRoles {
  detective: boolean;
  silencer: boolean;
  confuser: boolean;
  mayor: boolean;
}

export interface RoomSettings {
  discussionSec: 180 | 240;
  voteSec: 30 | 60;
  optional: OptionalRoles;
}

export type ActionKind = 'kill' | 'protect' | 'shoot' | 'investigate' | 'confuse' | 'silence';

export type Cause = 'mafia' | 'police';

export type GameEvent =
  | { kind: 'death'; id: PlayerId; causes: ('mafia' | 'police')[]; role: Role } // role = true role
  | { kind: 'saved'; id: PlayerId; from: 'mafia' | 'police' }
  | { kind: 'silenced'; id: PlayerId }
  | { kind: 'noDeaths' }
  | { kind: 'voteOut'; id: PlayerId; role: Role; by: 'vote' | 'mayor' }
  | { kind: 'voteTie' }
  | { kind: 'noElimination' }
  | { kind: 'disconnected'; id: PlayerId; role: Role }
  | { kind: 'gameOver'; winner: Team };

export interface PublicPlayer {
  id: PlayerId;
  nickname: string;
  status: 'alive' | 'dead' | 'disconnected';
  revealedRole: Role | null; // only after death/elimination/disconnect/gameOver
  silenced: boolean; // true only during the day it applies
  isHost: boolean;
  connected: boolean;
}

export interface ClientState {
  version: number;
  serverNow: number;
  roomCode: string;
  phase: Phase;
  round: number;
  phaseEndsAt: number | null;
  settings: RoomSettings;
  players: PublicPlayer[];
  me: {
    id: PlayerId;
    role: Role | null;
    team: Team | null;
    alive: boolean;
    isHost: boolean;
    bullets: number | null; // police only
    mafiaTeam: { id: PlayerId; role: Role }[] | null; // alive mafia only
    pendingAction: { kind: ActionKind; target: PlayerId | null } | null;
    allowedTargets: PlayerId[]; // for my current action/vote
    myVote: PlayerId | null;
    investigations: { round: number; target: PlayerId; result: 'mafia' | 'notMafia' }[]; // detective only
    mayorOptions: PlayerId[] | null; // only the mayor during mayorTiebreak
  };
  log: { round: number; phase: Phase; event: GameEvent }[]; // public events only
  voteResult: { counts: Record<PlayerId, number>; votes: Record<PlayerId, PlayerId | null> } | null;
  validPlayerCounts: number[]; // lobby: counts valid for current settings
  winner: Team | null;
  allRoles: Record<PlayerId, Role> | null; // only in gameOver
}
