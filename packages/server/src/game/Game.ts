import {
  type ActionKind,
  type GameEvent,
  type Phase,
  type PlayerId,
  type Role,
  type RoomSettings,
  type Team,
  type WinMode,
  assignRoles,
  buildRoleList,
  evaluateOutcome,
  isMafiaRole,
  getAbilityForRoleAndAction,
  type AbilityState,
  createDeathEvent,
  createDisconnectedEvent,
  createGameOverEvent,
  createNoDeathsEvent,
  createNoEliminationEvent,
  createSavedEvent,
  createSilencedEvent,
  createVoteOutEvent,
  createVoteTieEvent,
  DEFAULT_ROOM_SETTINGS,
  MAX_PLAYERS,
  MIN_PLAYERS,
  POLICE_STARTING_BULLETS,
  resolveNight,
  tally,
} from '@ontorale/shared';
import type { Clock } from './clock';
import { CryptoRng, generateSessionToken, timingSafeEqualString } from '../util/random';
import type { VoiceProvider } from '../voice/VoiceProvider';
import { FakeVoiceProvider } from '../voice/FakeVoiceProvider';

export interface GamePlayer {
  id: PlayerId;
  nickname: string;
  sessionToken: string;
  socketId: string | null;
  connected: boolean;
  isHost: boolean;
  joinedAt: number;
  role: Role | null;
  status: 'alive' | 'dead' | 'disconnected';
  silenced: boolean;
  revealedRole: Role | null;
}

export interface ChatMessage {
  id: string;
  channel: 'public' | 'mafia';
  from: PlayerId;
  nickname: string;
  text: string;
  ts: number;
}

export class Game {
  public roomCode: string;
  public phase: Phase = 'lobby';
  public round = 0;
  public version = 1;
  public phaseEndsAt: number | null = null;
  public phaseToken = 0;
  public settings: RoomSettings = { ...DEFAULT_ROOM_SETTINGS };
  public winner: Team | null = null;
  public log: { round: number; phase: Phase; event: GameEvent }[] = [];
  public policeBullets = POLICE_STARTING_BULLETS;

  private players = new Map<PlayerId, GamePlayer>();
  private pendingActions = new Map<PlayerId, { kind: ActionKind; target: PlayerId | null }>();
  private pendingVotes = new Map<PlayerId, PlayerId | null>();
  private detectiveInvestigations = new Map<
    PlayerId,
    { round: number; target: PlayerId; result: 'mafia' | 'notMafia' }[]
  >();
  private stalkerResults = new Map<
    PlayerId,
    { round: number; target: PlayerId; role: Role }[]
  >();
  private playerAbilityStates = new Map<PlayerId, AbilityState>();

  public publishedVoteResult: {
    counts: Record<PlayerId, number>;
    votes: Record<PlayerId, PlayerId | null>;
  } | null = null;

  public tiedCandidates: PlayerId[] | null = null;
  public chatHistory: ChatMessage[] = [];

  public clock: Clock;
  public rng: CryptoRng;
  public voiceProvider: VoiceProvider;
  public timerScale: number;
  public winMode: WinMode;
  public lastActivityAt: number;

  private onStateChange?: (game: Game) => void;
  private timerHandle?: unknown;

  constructor(options: {
    roomCode: string;
    clock: Clock;
    rng?: CryptoRng;
    voiceProvider?: VoiceProvider;
    timerScale?: number;
    winMode?: WinMode;
    onStateChange?: (game: Game) => void;
  }) {
    this.roomCode = options.roomCode;
    this.clock = options.clock;
    this.rng = options.rng ?? new CryptoRng();
    this.voiceProvider = options.voiceProvider ?? new FakeVoiceProvider();
    this.timerScale = options.timerScale ?? 1;
    this.winMode = options.winMode ?? 'parity';
    this.onStateChange = options.onStateChange;
    this.lastActivityAt = this.clock.now();
  }

  // -------------------------------------------------------------
  // Player Management (Lobby & Game)
  // -------------------------------------------------------------

  addPlayer(
    nickname: string,
    isHost = false,
  ): { player: GamePlayer; sessionToken: string } | { error: string } {
    if (this.phase !== 'lobby') {
      return { error: 'wrongPhase' };
    }
    if (this.players.size >= MAX_PLAYERS) {
      return { error: 'roomFull' };
    }

    const trimmed = nickname.trim();
    for (const p of this.players.values()) {
      if (p.nickname.toLowerCase() === trimmed.toLowerCase()) {
        return { error: 'nicknameTaken' };
      }
    }

    const playerId = `p_${this.players.size + 1}_${Math.random().toString(36).substring(2, 7)}`;
    const sessionToken = generateSessionToken();

    const player: GamePlayer = {
      id: playerId,
      nickname: trimmed,
      sessionToken,
      socketId: null,
      connected: true,
      isHost,
      joinedAt: this.clock.now(),
      role: null,
      status: 'alive',
      silenced: false,
      revealedRole: null,
    };

    this.players.set(playerId, player);
    this.touch();
    return { player, sessionToken };
  }

  removePlayer(playerId: PlayerId): { destroyed: boolean; newHostId?: PlayerId } {
    const player = this.players.get(playerId);
    if (!player) return { destroyed: false };

    if (this.phase === 'lobby') {
      this.players.delete(playerId);
      if (this.players.size === 0) {
        return { destroyed: true };
      }

      let newHostId: PlayerId | undefined;
      if (player.isHost) {
        // Earliest joined remaining player becomes host (D17)
        const sorted = Array.from(this.players.values()).sort((a, b) => a.joinedAt - b.joinedAt);
        if (sorted.length > 0) {
          sorted[0].isHost = true;
          newHostId = sorted[0].id;
        }
      }

      this.touch();
      return { destroyed: false, newHostId };
    } else {
      // In active game: D12 immediate removal
      this.handleMidGameDisconnect(playerId);
      return { destroyed: this.connectedPlayersCount() === 0 };
    }
  }

  authenticate(sessionToken: string): GamePlayer | null {
    for (const player of this.players.values()) {
      if (timingSafeEqualString(player.sessionToken, sessionToken)) {
        return player;
      }
    }
    return null;
  }

  getPlayer(id: PlayerId): GamePlayer | undefined {
    return this.players.get(id);
  }

  getAllPlayers(): GamePlayer[] {
    return Array.from(this.players.values());
  }

  getAlivePlayers(): GamePlayer[] {
    return Array.from(this.players.values()).filter((p) => p.status === 'alive');
  }

  connectedPlayersCount(): number {
    return Array.from(this.players.values()).filter((p) => p.connected).length;
  }

  public getAbilityState(playerId: PlayerId): AbilityState {
    let s = this.playerAbilityStates.get(playerId);
    if (!s) {
      s = { used: {}, cooldownUntilRound: {}, disabledUntilRound: 0 };
      this.playerAbilityStates.set(playerId, s);
    }
    return s;
  }

  public getHabildarBullets(playerId: PlayerId): number {
    const s = this.getAbilityState(playerId);
    return Math.max(0, 1 - (s.used['shoot'] ?? 0));
  }

  public getStalkerResults(playerId: PlayerId): { round: number; target: PlayerId; role: Role }[] {
    return this.stalkerResults.get(playerId) ?? [];
  }

  public getPlayerAbilityStatus(playerId: PlayerId) {
    const p = this.players.get(playerId);
    if (!p) return undefined;
    const s = this.getAbilityState(playerId);
    return {
      investigate: { remaining: Math.max(0, 2 - (s.used['investigate'] ?? 0)) },
      stalk: { remaining: Math.max(0, 2 - (s.used['stalk'] ?? 0)) },
      shoot: {
        remaining:
          p.role === 'police'
            ? this.policeBullets
            : Math.max(0, 1 - (s.used['shoot'] ?? 0)),
      },
      disable: {
        cooldownUntilRound: s.cooldownUntilRound['disable'] ?? 0,
        canUse: this.round >= (s.cooldownUntilRound['disable'] ?? 0),
      },
      disabled: {
        untilRound: s.disabledUntilRound,
        active: s.disabledUntilRound > 0 && this.round <= s.disabledUntilRound,
      },
    };
  }

  // -------------------------------------------------------------
  // Settings & Host Controls
  // -------------------------------------------------------------

  updateSettings(callerId: PlayerId, newSettings: RoomSettings): { ok: true } | { error: string } {
    if (this.phase !== 'lobby') {
      return { error: 'wrongPhase' };
    }
    const caller = this.players.get(callerId);
    if (!caller || !caller.isHost) {
      return { error: 'notHost' };
    }

    // Verify settings can be valid for at least one player count in 6..15
    const validCounts = Object.keys({
      6: 1,
      7: 1,
      8: 2,
      9: 2,
      10: 3,
      11: 3,
      12: 4,
      13: 4,
      14: 4,
      15: 4,
    })
      .map(Number)
      .filter((n) => !('error' in (buildRoleList(n, newSettings.optional) as object)));

    if (validCounts.length === 0) {
      return { error: 'roleConfigInvalid' };
    }

    this.settings = newSettings;
    this.touch();
    return { ok: true };
  }

  canStart():
    | { ok: true }
    | { error: 'notHost' | 'wrongPhase' | 'playerCountInvalid' | 'roleConfigInvalid' } {
    if (this.phase !== 'lobby') return { error: 'wrongPhase' };
    const count = this.players.size;
    if (count < MIN_PLAYERS || count > MAX_PLAYERS) return { error: 'playerCountInvalid' };

    const roleCheck = buildRoleList(count, this.settings.optional);
    if ('error' in roleCheck) {
      return { error: roleCheck.error };
    }
    return { ok: true };
  }

  startGame(callerId: PlayerId): { ok: true } | { error: string } {
    const caller = this.players.get(callerId);
    if (!caller || !caller.isHost) return { error: 'notHost' };

    const check = this.canStart();
    if ('error' in check) return { error: check.error };

    // Assign roles uniformly and securely
    const playerIds = Array.from(this.players.keys());
    const assigned = assignRoles(playerIds, this.settings.optional, this.rng);
    if ('error' in assigned) {
      return { error: assigned.error };
    }

    for (const [id, role] of Object.entries(assigned)) {
      const p = this.players.get(id)!;
      p.role = role;
      p.status = 'alive';
      p.silenced = false;
      p.revealedRole = null;
    }

    this.policeBullets = POLICE_STARTING_BULLETS;
    this.round = 1;
    this.winner = null;
    this.log = [];
    this.publishedVoteResult = null;
    this.tiedCandidates = null;
    this.playerAbilityStates.clear();
    this.stalkerResults.clear();
    for (const id of playerIds) {
      this.playerAbilityStates.set(id, {
        used: {},
        cooldownUntilRound: {},
        disabledUntilRound: 0,
      });
    }

    this.enterPhase('night');
    return { ok: true };
  }

  rematch(callerId: PlayerId): { ok: true } | { error: string } {
    if (this.phase !== 'gameOver') return { error: 'wrongPhase' };
    const caller = this.players.get(callerId);
    if (!caller || !caller.isHost) return { error: 'notHost' };

    // Remove disconnected players (D21)
    for (const [id, p] of this.players.entries()) {
      if (p.status === 'disconnected' || !p.connected) {
        this.players.delete(id);
      } else {
        p.role = null;
        p.status = 'alive';
        p.silenced = false;
        p.revealedRole = null;
      }
    }

    // Reset game state
    this.round = 0;
    this.winner = null;
    this.log = [];
    this.publishedVoteResult = null;
    this.tiedCandidates = null;
    this.pendingActions.clear();
    this.pendingVotes.clear();
    this.detectiveInvestigations.clear();

    this.enterPhase('lobby');
    return { ok: true };
  }

  // -------------------------------------------------------------
  // Phase Transitions & Timers
  // -------------------------------------------------------------

  private durationMs(seconds: number): number {
    return Math.max(1, Math.round(seconds * 1000 * this.timerScale));
  }

  public enterPhase(phase: Phase): void {
    if (this.timerHandle) {
      this.clock.clearTimeout(this.timerHandle);
      this.timerHandle = undefined;
    }

    this.phase = phase;
    this.phaseToken++;
    const currentToken = this.phaseToken;

    let durationSec = 0;
    switch (phase) {
      case 'lobby':
      case 'gameOver':
        this.phaseEndsAt = null;
        break;
      case 'night':
        durationSec = 120; // fixed 120s
        break;
      case 'nightResult':
      case 'voteResult':
        durationSec = 10; // fixed 10s
        break;
      case 'discussion':
        durationSec = this.settings.discussionSec;
        break;
      case 'voting':
        durationSec = this.settings.voteSec;
        break;
      case 'mayorTiebreak':
        durationSec = 20; // fixed 20s
        break;
    }

    if (durationSec > 0) {
      const ms = this.durationMs(durationSec);
      this.phaseEndsAt = this.clock.now() + ms;
      this.timerHandle = this.clock.setTimeout(() => {
        this.onTimerExpired(currentToken);
      }, ms);
    }

    this.touch();
    this.syncVoicePermissions();
  }

  private onTimerExpired(token: number): void {
    if (token !== this.phaseToken) return; // Stale timer ignored

    switch (this.phase) {
      case 'night':
        this.resolveNightPhase();
        break;
      case 'nightResult':
        this.enterPhase('discussion');
        break;
      case 'discussion':
        this.enterPhase('voting');
        break;
      case 'voting':
        this.resolveVotingPhase();
        break;
      case 'mayorTiebreak':
        // Mayor timeout -> nobody is eliminated (D11)
        this.resolveMayorTiebreak(null);
        break;
      case 'voteResult':
        this.checkWinAfterVoteResult();
        break;
    }
  }

  // -------------------------------------------------------------
  // Actions, Voting, and Mayor Resolution
  // -------------------------------------------------------------

  submitAction(
    callerId: PlayerId,
    kind: ActionKind,
    targetId: PlayerId | null,
  ): { ok: true } | { error: string } {
    if (this.phase !== 'night') return { error: 'wrongPhase' };
    const player = this.players.get(callerId);
    if (!player || player.status !== 'alive') return { error: 'notAllowed' };

    const role = player.role;
    if (!role) return { error: 'notAllowed' };

    const ability = getAbilityForRoleAndAction(role, kind);
    if (!ability) return { error: 'notAllowed' };

    const abilityState = this.getAbilityState(callerId);

    // Lifetime limit check
    if (ability.lifetimeLimit && (abilityState.used[ability.id] ?? 0) >= ability.lifetimeLimit) {
      return { error: 'limitReached' };
    }

    // Cooldown check
    if (ability.cooldownRounds && this.round < (abilityState.cooldownUntilRound[ability.id] ?? 0)) {
      return { error: 'abilityUnavailable' };
    }

    // Disable check
    if (
      ability.disableable &&
      abilityState.disabledUntilRound > 0 &&
      this.round <= abilityState.disabledUntilRound
    ) {
      return { error: 'abilityUnavailable' };
    }

    if (role === 'police' && kind === 'shoot' && targetId !== null && this.policeBullets <= 0) {
      return { error: 'noBullets' };
    }

    if (
      role === 'habildar' &&
      kind === 'shoot' &&
      targetId !== null &&
      this.getHabildarBullets(callerId) <= 0
    ) {
      return { error: 'limitReached' };
    }

    // Target validation
    if (targetId !== null) {
      const target = this.players.get(targetId);
      if (!target || target.status !== 'alive') {
        return { error: 'invalidTarget' };
      }

      if (role === 'habildar' && kind === 'disable') {
        if (!target.role || !isMafiaRole(target.role)) {
          return { error: 'invalidTarget' };
        }
      } else if (role === 'stalker' && kind === 'stalk') {
        if (!target.role || isMafiaRole(target.role) || targetId === callerId) {
          return { error: 'invalidTarget' };
        }
      } else if (role === 'doctor' || role === 'confuser') {
        // self is allowed
      } else {
        if (targetId === callerId) {
          return { error: 'invalidTarget' };
        }
      }
    } else {
      const allowNone = role === 'killer' || role === 'police' || role === 'habildar';
      if (!allowNone) {
        return { error: 'invalidTarget' };
      }
    }

    // Changing actions allowed until timer end (D5)
    this.pendingActions.set(callerId, { kind, target: targetId });
    this.touch();
    return { ok: true };
  }

  castVote(callerId: PlayerId, targetId: PlayerId | null): { ok: true } | { error: string } {
    if (this.phase !== 'voting') return { error: 'wrongPhase' };
    const player = this.players.get(callerId);
    if (!player || player.status !== 'alive') return { error: 'notAllowed' };

    if (targetId !== null) {
      const target = this.players.get(targetId);
      if (!target || target.status !== 'alive' || targetId === callerId) {
        return { error: 'invalidTarget' };
      }
    }

    this.pendingVotes.set(callerId, targetId);
    this.touch();
    return { ok: true };
  }

  mayorDecide(callerId: PlayerId, targetId: PlayerId | null): { ok: true } | { error: string } {
    if (this.phase !== 'mayorTiebreak') return { error: 'wrongPhase' };
    const player = this.players.get(callerId);
    if (!player || player.role !== 'mayor' || player.status !== 'alive') {
      return { error: 'notAllowed' };
    }

    if (targetId !== null) {
      if (!this.tiedCandidates || !this.tiedCandidates.includes(targetId)) {
        return { error: 'invalidTarget' };
      }
    }

    this.resolveMayorTiebreak(targetId);
    return { ok: true };
  }

  private resolveNightPhase(): void {
    const nightPlayers = Array.from(this.players.values()).map((p) => {
      const abilityState = this.getAbilityState(p.id);
      return {
        id: p.id,
        role: p.role!,
        alive: p.status === 'alive',
        disabled: abilityState.disabledUntilRound > 0 && this.round <= abilityState.disabledUntilRound,
      };
    });

    const killerPicks: Record<PlayerId, PlayerId | null> = {};
    let doctorProtect: PlayerId | null = null;
    let policeShot: PlayerId | null = null;
    let detectiveTarget: PlayerId | null = null;
    let confuserTarget: PlayerId | null = null;
    let silencerTarget: PlayerId | null = null;
    let habildarAction: { kind: 'shoot' | 'disable' | 'skip'; targetId: PlayerId | null } | null = null;
    let stalkerTarget: PlayerId | null = null;

    for (const [id, action] of this.pendingActions.entries()) {
      const p = this.players.get(id);
      if (!p || p.status !== 'alive') continue;

      if (action.kind === 'kill') killerPicks[id] = action.target;
      if (action.kind === 'protect') doctorProtect = action.target;
      if (action.kind === 'shoot' && p.role === 'police') policeShot = action.target;
      if (action.kind === 'investigate') detectiveTarget = action.target;
      if (action.kind === 'confuse') confuserTarget = action.target;
      if (action.kind === 'silence') silencerTarget = action.target;
      if (p.role === 'habildar') {
        if (action.kind === 'shoot') habildarAction = { kind: 'shoot', targetId: action.target };
        else if (action.kind === 'disable') habildarAction = { kind: 'disable', targetId: action.target };
        else habildarAction = { kind: 'skip', targetId: null };
      }
      if (action.kind === 'stalk') stalkerTarget = action.target;
    }

    const habildarPlayer = Array.from(this.players.values()).find((p) => p.role === 'habildar');
    const habildarBullets = habildarPlayer ? this.getHabildarBullets(habildarPlayer.id) : 0;

    const outcome = resolveNight(
      nightPlayers,
      {
        killerPicks,
        doctorProtect,
        policeShot,
        detectiveTarget,
        confuserTarget,
        silencerTarget,
        habildarAction,
        stalkerTarget,
      },
      this.policeBullets,
      habildarBullets,
    );

    // Spend police bullets
    if (outcome.bulletsSpent > 0) {
      this.policeBullets -= outcome.bulletsSpent;
    }

    // Spend habildar bullets
    if (outcome.habildarBulletsSpent && habildarPlayer) {
      const hs = this.getAbilityState(habildarPlayer.id);
      hs.used['shoot'] = (hs.used['shoot'] ?? 0) + 1;
    }

    // Habildar disable target
    if (outcome.disabledTarget && habildarPlayer) {
      const hs = this.getAbilityState(habildarPlayer.id);
      hs.cooldownUntilRound['disable'] = this.round + 2;
      const targetState = this.getAbilityState(outcome.disabledTarget);
      targetState.disabledUntilRound = this.round + 2;
    }

    // Record detective investigation privately and count use
    if (outcome.investigation) {
      const det = Array.from(this.players.values()).find((p) => p.role === 'detective');
      if (det) {
        const ds = this.getAbilityState(det.id);
        ds.used['investigate'] = (ds.used['investigate'] ?? 0) + 1;
        const invs = this.detectiveInvestigations.get(det.id) || [];
        invs.push({
          round: this.round,
          target: outcome.investigation.target,
          result: outcome.investigation.result,
        });
        this.detectiveInvestigations.set(det.id, invs);
      }
    }

    // Record stalker result privately and count use
    if (outcome.stalkResult) {
      const stalker = Array.from(this.players.values()).find((p) => p.role === 'stalker');
      if (stalker) {
        const ss = this.getAbilityState(stalker.id);
        ss.used['stalk'] = (ss.used['stalk'] ?? 0) + 1;
        const resList = this.stalkerResults.get(stalker.id) || [];
        resList.push({
          round: this.round,
          target: outcome.stalkResult.target,
          role: outcome.stalkResult.role,
        });
        this.stalkerResults.set(stalker.id, resList);
      }
    }

    // Apply deaths together (Section 3 point 3)
    for (const d of outcome.deaths) {
      const deadPlayer = this.players.get(d.id);
      if (deadPlayer) {
        deadPlayer.status = 'dead';
        deadPlayer.revealedRole = deadPlayer.role;
        this.log.push({
          round: this.round,
          phase: 'night',
          event: createDeathEvent(deadPlayer.id, d.causes, deadPlayer.role!),
        });
      }
    }

    // Apply saves
    for (const s of outcome.saves) {
      this.log.push({
        round: this.round,
        phase: 'night',
        event: createSavedEvent(s.id, s.from),
      });
    }

    // Apply silence
    for (const p of this.players.values()) {
      p.silenced = false;
    }
    if (outcome.silenced) {
      const silencedPlayer = this.players.get(outcome.silenced);
      if (silencedPlayer && silencedPlayer.status === 'alive') {
        silencedPlayer.silenced = true;
        this.log.push({
          round: this.round,
          phase: 'night',
          event: createSilencedEvent(outcome.silenced),
        });
      }
    }

    // If no deaths occurred: publish noDeaths event
    if (outcome.deaths.length === 0) {
      this.log.push({
        round: this.round,
        phase: 'night',
        event: createNoDeathsEvent(),
      });
    }

    // Clear pending actions
    this.pendingActions.clear();

    // Section 3: After all simultaneous deaths are applied, evaluate win condition
    if (this.afterMutation()) return;

    this.enterPhase('nightResult');
  }

  private resolveVotingPhase(): void {
    const aliveIds = this.getAlivePlayers().map((p) => p.id);
    const votesRecord: Record<PlayerId, PlayerId | null> = {};
    for (const [voterId, target] of this.pendingVotes.entries()) {
      votesRecord[voterId] = target;
    }

    const { counts, top } = tally(aliveIds, votesRecord);

    // Publish vote tallies and who voted for whom (D10)
    this.publishedVoteResult = {
      counts,
      votes: votesRecord,
    };

    if (top.length === 1) {
      // Exactly 1 leader eliminated
      const eliminatedId = top[0];
      const target = this.players.get(eliminatedId);
      if (target) {
        target.status = 'dead';
        target.revealedRole = target.role;
        this.log.push({
          round: this.round,
          phase: 'voting',
          event: createVoteOutEvent(eliminatedId, target.role!, 'vote'),
        });
      }
      this.pendingVotes.clear();
      if (this.afterMutation()) return;
      this.enterPhase('voteResult');
    } else if (top.length >= 2) {
      // Tie
      this.log.push({
        round: this.round,
        phase: 'voting',
        event: createVoteTieEvent(),
      });

      const mayor = Array.from(this.players.values()).find((p) => p.role === 'mayor');
      if (mayor && mayor.status === 'alive') {
        this.tiedCandidates = top;
        this.enterPhase('mayorTiebreak');
      } else {
        // No alive mayor -> no elimination
        this.log.push({
          round: this.round,
          phase: 'voting',
          event: createNoEliminationEvent(),
        });
        this.enterPhase('voteResult');
      }
      this.pendingVotes.clear();
    } else {
      // top.length === 0 (everyone abstained)
      this.log.push({
        round: this.round,
        phase: 'voting',
        event: createNoEliminationEvent(),
      });
      this.pendingVotes.clear();
      this.enterPhase('voteResult');
    }
  }

  private resolveMayorTiebreak(chosenTargetId: PlayerId | null): void {
    if (chosenTargetId) {
      const target = this.players.get(chosenTargetId);
      if (target && target.status === 'alive') {
        target.status = 'dead';
        target.revealedRole = target.role;
        this.log.push({
          round: this.round,
          phase: 'mayorTiebreak',
          event: createVoteOutEvent(chosenTargetId, target.role!, 'mayor'),
        });
      }
    } else {
      this.log.push({
        round: this.round,
        phase: 'mayorTiebreak',
        event: createNoEliminationEvent(),
      });
    }

    this.tiedCandidates = null;
    if (this.afterMutation()) return;
    this.enterPhase('voteResult');
  }

  private checkWinAfterVoteResult(): void {
    if (this.phase === 'gameOver') return;
    if (this.afterMutation()) return;
    this.round++;
    this.enterPhase('night');
  }

  public handleMidGameDisconnect(playerId: PlayerId): void {
    const player = this.players.get(playerId);
    if (!player) return;

    player.connected = false;
    player.status = 'disconnected';
    player.revealedRole = player.role; // D12 role revealed

    // Discard pending action / vote
    this.pendingActions.delete(playerId);
    this.pendingVotes.delete(playerId);

    this.log.push({
      round: this.round,
      phase: this.phase,
      event: createDisconnectedEvent(playerId, player.role ?? 'citizen'),
    });

    // Mayor disconnect during tiebreak resolves to nobody (GAME-02)
    if (this.phase === 'mayorTiebreak' && player.role === 'mayor') {
      this.resolveMayorTiebreak(null);
      return;
    }

    // Win condition is re-checked at once
    if (this.afterMutation()) return;
    this.touch();
  }

  public afterMutation(): boolean {
    if (this.phase === 'lobby' || this.phase === 'gameOver') return false;

    const winner = evaluateOutcome({ players: this.players.values(), winMode: this.winMode });
    if (winner) {
      this.endGame(winner);
      return true;
    }
    return false;
  }

  private evaluateWinCondition(): Team | null {
    if (this.phase === 'lobby') return null;
    return evaluateOutcome({ players: this.players.values(), winMode: this.winMode });
  }

  private endGame(winner: Team): void {
    if (this.phase === 'gameOver') return;
    this.winner = winner;
    if (this.timerHandle) {
      this.clock.clearTimeout(this.timerHandle);
      this.timerHandle = undefined;
    }
    this.phaseEndsAt = null;
    this.log.push({
      round: this.round,
      phase: this.phase,
      event: createGameOverEvent(winner),
    });
    this.enterPhase('gameOver');
    this.touch();
    this.syncVoicePermissions().catch(() => {});
  }

  // -------------------------------------------------------------
  // Helpers for Client State & Projections
  // -------------------------------------------------------------

  getAllowedTargets(playerId: PlayerId): PlayerId[] {
    const player = this.players.get(playerId);
    if (!player || player.status !== 'alive') return [];

    const aliveOthers = this.getAlivePlayers()
      .filter((p) => p.id !== playerId)
      .map((p) => p.id);

    if (this.phase === 'night') {
      const abilityState = this.getAbilityState(playerId);
      const isActorDisabled =
        abilityState.disabledUntilRound > 0 && this.round <= abilityState.disabledUntilRound;

      switch (player.role) {
        case 'killer':
          return aliveOthers;
        case 'doctor':
          return this.getAlivePlayers().map((p) => p.id); // self allowed
        case 'police':
          if (this.policeBullets <= 0) return [];
          return aliveOthers;
        case 'detective':
          if ((abilityState.used['investigate'] ?? 0) >= 2) return [];
          if (isActorDisabled) return [];
          return aliveOthers;
        case 'confuser':
          if (isActorDisabled) return [];
          return this.getAlivePlayers().map((p) => p.id); // self allowed
        case 'silencer':
          if (isActorDisabled) return [];
          return aliveOthers;
        case 'habildar':
          return aliveOthers;
        case 'stalker':
          if ((abilityState.used['stalk'] ?? 0) >= 2) return [];
          if (isActorDisabled) return [];
          return this.getAlivePlayers()
            .filter((p) => p.id !== playerId && p.role && !isMafiaRole(p.role))
            .map((p) => p.id);
        default:
          return [];
      }
    }

    if (this.phase === 'voting') {
      return aliveOthers;
    }

    return [];
  }

  getPendingAction(playerId: PlayerId): { kind: ActionKind; target: PlayerId | null } | null {
    return this.pendingActions.get(playerId) ?? null;
  }

  getPendingVote(playerId: PlayerId): PlayerId | null {
    return this.pendingVotes.get(playerId) ?? null;
  }

  getDetectiveInvestigations(
    playerId: PlayerId,
  ): { round: number; target: PlayerId; result: 'mafia' | 'notMafia' }[] {
    return this.detectiveInvestigations.get(playerId) ?? [];
  }

  // -------------------------------------------------------------
  // Voice Permissions Sync
  // -------------------------------------------------------------

  async syncVoicePermissions(): Promise<void> {
    try {
      const pubRoom = `ontorale-${this.roomCode}-pub`;
      const mafRoom = `ontorale-${this.roomCode}-maf`;

      const aliveMafiaIds = new Set(
        this.getAlivePlayers()
          .filter((p) => p.role && isMafiaRole(p.role))
          .map((p) => p.id),
      );

      for (const player of this.players.values()) {
        let pubPublish = false;
        let mafPublish = false;

        if (this.phase === 'lobby') {
          pubPublish = player.connected;
        } else if (this.phase === 'discussion') {
          pubPublish = player.status === 'alive' && !player.silenced;
        } else if (this.phase === 'gameOver') {
          pubPublish = player.connected;
        }

        if (this.phase === 'night') {
          mafPublish = aliveMafiaIds.has(player.id);
        }

        await this.voiceProvider.setCanPublish(pubRoom, player.id, pubPublish);

        if (aliveMafiaIds.has(player.id)) {
          await this.voiceProvider.setCanPublish(mafRoom, player.id, mafPublish);
        } else if (player.status !== 'alive') {
          await this.voiceProvider.removeParticipant(mafRoom, player.id);
        }
      }

      if (this.phase === 'gameOver') {
        await this.voiceProvider.destroyRoom(mafRoom);
      }
    } catch {
      // Ignore voice errors
    }
  }

  touch(): void {
    this.version++;
    this.lastActivityAt = this.clock.now();
    if (this.onStateChange) {
      this.onStateChange(this);
    }
  }
}
