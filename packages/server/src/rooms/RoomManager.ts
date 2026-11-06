import { type RoomSettings, MAX_ROOMS } from '@ontorale/shared';
import { Game } from '../game/Game';
import type { Clock } from '../game/clock';
import { SystemClock } from '../game/clock';
import { CryptoRng, generateRoomCode } from '../util/random';
import type { VoiceProvider } from '../voice/VoiceProvider';
import { FakeVoiceProvider } from '../voice/FakeVoiceProvider';
import type { EnvConfig } from '../config';

export class RoomManager {
  private rooms = new Map<string, Game>();
  private clock: Clock;
  private rng: CryptoRng;
  private voiceProvider: VoiceProvider;
  private config: EnvConfig;
  private onGameBroadcast?: (game: Game) => void;

  constructor(
    config: EnvConfig,
    options?: {
      clock?: Clock;
      rng?: CryptoRng;
      voiceProvider?: VoiceProvider;
      onGameBroadcast?: (game: Game) => void;
    },
  ) {
    this.config = config;
    this.clock = options?.clock ?? new SystemClock();
    this.rng = options?.rng ?? new CryptoRng();
    this.voiceProvider = options?.voiceProvider ?? new FakeVoiceProvider();
    this.onGameBroadcast = options?.onGameBroadcast;
  }

  setBroadcastHandler(handler: (game: Game) => void): void {
    this.onGameBroadcast = handler;
  }

  createRoom(
    nickname: string,
    settings?: RoomSettings,
  ):
    | { ok: true; roomCode: string; playerId: string; sessionToken: string; game: Game }
    | { ok: false; error: string } {
    if (this.rooms.size >= (this.config.MAX_ROOMS || MAX_ROOMS)) {
      return { ok: false, error: 'tooManyRooms' };
    }

    let roomCode = generateRoomCode(this.rng);
    let attempts = 0;
    while (this.rooms.has(roomCode) && attempts < 100) {
      roomCode = generateRoomCode(this.rng);
      attempts++;
    }
    if (this.rooms.has(roomCode)) {
      return { ok: false, error: 'tooManyRooms' };
    }

    const game = new Game({
      roomCode,
      clock: this.clock,
      rng: this.rng,
      voiceProvider: this.voiceProvider,
      timerScale: this.config.TIMER_SCALE,
      winMode: this.config.MAFIA_WIN_MODE,
      onStateChange: (g) => {
        if (this.onGameBroadcast) {
          this.onGameBroadcast(g);
        }
      },
    });

    if (settings) {
      game.settings = settings;
    }

    const res = game.addPlayer(nickname, true);
    if ('error' in res) {
      return { ok: false, error: res.error };
    }

    this.rooms.set(roomCode, game);
    return {
      ok: true,
      roomCode,
      playerId: res.player.id,
      sessionToken: res.sessionToken,
      game,
    };
  }

  joinRoom(
    roomCode: string,
    nickname: string,
  ):
    | { ok: true; playerId: string; sessionToken: string; game: Game }
    | { ok: false; error: string } {
    const game = this.rooms.get(roomCode);
    if (!game) {
      return { ok: false, error: 'notFound' };
    }

    const res = game.addPlayer(nickname, false);
    if ('error' in res) {
      return { ok: false, error: res.error };
    }

    return {
      ok: true,
      playerId: res.player.id,
      sessionToken: res.sessionToken,
      game,
    };
  }

  resumeRoom(
    roomCode: string,
    sessionToken: string,
  ): { ok: true; playerId: string; game: Game } | { ok: false; error: string } {
    const game = this.rooms.get(roomCode);
    if (!game) {
      return { ok: false, error: 'notFound' };
    }

    const player = game.authenticate(sessionToken);
    if (!player) {
      return { ok: false, error: 'badRequest' };
    }

    // Reconnection is allowed only in lobby/gameOver (D12)
    if (game.phase !== 'lobby' && game.phase !== 'gameOver') {
      return { ok: false, error: 'gameInProgress' };
    }

    player.connected = true;
    game.touch();
    return { ok: true, playerId: player.id, game };
  }

  getRoom(roomCode: string): Game | undefined {
    return this.rooms.get(roomCode);
  }

  deleteRoom(roomCode: string): void {
    const game = this.rooms.get(roomCode);
    if (game) {
      this.voiceProvider.destroyRoom(`ontorale-${roomCode}-pub`).catch(() => {});
      this.voiceProvider.destroyRoom(`ontorale-${roomCode}-maf`).catch(() => {});
      this.rooms.delete(roomCode);
    }
  }

  activeGamesCount(): number {
    let count = 0;
    for (const g of this.rooms.values()) {
      if (g.phase !== 'lobby' && g.phase !== 'gameOver') {
        count++;
      }
    }
    return count;
  }

  roomsCount(): number {
    return this.rooms.size;
  }

  idleCleanupSweep(maxIdleMs = 30 * 60 * 1000): void {
    const now = this.clock.now();
    for (const [code, game] of this.rooms.entries()) {
      if (game.connectedPlayersCount() === 0 && now - game.lastActivityAt >= maxIdleMs) {
        this.deleteRoom(code);
      }
    }
  }
}
