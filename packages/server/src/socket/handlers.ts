import type { Server, Socket } from 'socket.io';
import {
  ActionSubmitSchema,
  ChatSendSchema,
  MayorDecideSchema,
  RoomCreateSchema,
  RoomJoinSchema,
  RoomResumeSchema,
  RoomSettingsSchema,
  VoiceReadySchema,
  VoiceTokenSchema,
  VoteCastSchema,
  isMafiaRole,
} from '@ontorale/shared';
import type { RoomManager } from '../rooms/RoomManager';
import { ipRoomCreateLimiter, SocketRateLimiter } from './rateLimit';
import { projectFor } from '../game/projection';
import type { Game } from '../game/Game';
import type { EnvConfig } from '../config';

interface SocketData {
  roomCode?: string;
  playerId?: string;
  rateLimiter: SocketRateLimiter;
}

export function registerSocketHandlers(
  io: Server,
  roomManager: RoomManager,
  config: EnvConfig,
): void {
  // Global broadcast handler for game mutations
  roomManager.setBroadcastHandler((game: Game) => {
    broadcastGameState(io, game);
  });

  io.on('connection', (socket: Socket) => {
    const socketData: SocketData = {
      rateLimiter: new SocketRateLimiter(),
    };
    (socket as unknown as { data: SocketData }).data = socketData;

    const getClientIp = (): string => {
      const forwarded = socket.handshake.headers['x-forwarded-for'];
      if (typeof forwarded === 'string') {
        return forwarded.split(',')[0].trim();
      }
      return socket.handshake.address || socket.id;
    };

    // -----------------------------------------------------------
    // room:create
    // -----------------------------------------------------------
    socket.on('room:create', (payload, ack) => {
      if (typeof ack !== 'function') return;

      const ip = getClientIp();
      if (config.NODE_ENV === 'production' && !ipRoomCreateLimiter.check(ip)) {
        return ack({ ok: false, error: 'rateLimited' });
      }

      const parsed = RoomCreateSchema.safeParse(payload);
      if (!parsed.success) {
        return ack({ ok: false, error: 'badRequest' });
      }

      const res = roomManager.createRoom(parsed.data.nickname, parsed.data.settings);
      if (!res.ok) {
        return ack({ ok: false, error: res.error });
      }

      socketData.roomCode = res.roomCode;
      socketData.playerId = res.playerId;
      socket.join(res.roomCode);

      const player = res.game.getPlayer(res.playerId);
      if (player) {
        player.socketId = socket.id;
      }

      ack({
        ok: true,
        data: {
          roomCode: res.roomCode,
          playerId: res.playerId,
          sessionToken: res.sessionToken,
        },
      });

      // Send initial state to host
      socket.emit('state', projectFor(res.game, res.playerId));
    });

    // -----------------------------------------------------------
    // room:join
    // -----------------------------------------------------------
    socket.on('room:join', (payload, ack) => {
      if (typeof ack !== 'function') return;

      const parsed = RoomJoinSchema.safeParse(payload);
      if (!parsed.success) {
        return ack({ ok: false, error: 'badRequest' });
      }

      const res = roomManager.joinRoom(parsed.data.roomCode, parsed.data.nickname);
      if (!res.ok) {
        return ack({ ok: false, error: res.error });
      }

      socketData.roomCode = parsed.data.roomCode;
      socketData.playerId = res.playerId;
      socket.join(parsed.data.roomCode);

      const player = res.game.getPlayer(res.playerId);
      if (player) {
        player.socketId = socket.id;
      }

      ack({
        ok: true,
        data: {
          playerId: res.playerId,
          sessionToken: res.sessionToken,
        },
      });

      broadcastGameState(io, res.game);
    });

    // -----------------------------------------------------------
    // room:resume
    // -----------------------------------------------------------
    socket.on('room:resume', (payload, ack) => {
      if (typeof ack !== 'function') return;

      const parsed = RoomResumeSchema.safeParse(payload);
      if (!parsed.success) {
        return ack({ ok: false, error: 'badRequest' });
      }

      const res = roomManager.resumeRoom(parsed.data.roomCode, parsed.data.sessionToken);
      if (!res.ok) {
        return ack({ ok: false, error: res.error });
      }

      socketData.roomCode = parsed.data.roomCode;
      socketData.playerId = res.playerId;
      socket.join(parsed.data.roomCode);

      const player = res.game.getPlayer(res.playerId);
      if (player) {
        player.socketId = socket.id;
        player.connected = true;
      }

      ack({
        ok: true,
        data: {
          playerId: res.playerId,
        },
      });

      // Send state & chat history allowed
      socket.emit('state', projectFor(res.game, res.playerId));
      sendChatHistory(socket, res.game, res.playerId);
    });

    // -----------------------------------------------------------
    // room:settings
    // -----------------------------------------------------------
    socket.on('room:settings', (payload, ack) => {
      if (typeof ack !== 'function') return;
      if (!socketData.roomCode || !socketData.playerId) {
        return ack({ ok: false, error: 'badRequest' });
      }

      const parsed = RoomSettingsSchema.safeParse(payload);
      if (!parsed.success) {
        return ack({ ok: false, error: 'badRequest' });
      }

      const game = roomManager.getRoom(socketData.roomCode);
      if (!game) return ack({ ok: false, error: 'notFound' });

      const res = game.updateSettings(socketData.playerId, parsed.data);
      if ('error' in res) {
        return ack({ ok: false, error: res.error });
      }

      ack({ ok: true });
      broadcastGameState(io, game);
    });

    // -----------------------------------------------------------
    // room:start
    // -----------------------------------------------------------
    socket.on('room:start', (_payload, ack) => {
      if (typeof ack !== 'function') return;
      if (!socketData.roomCode || !socketData.playerId) {
        return ack({ ok: false, error: 'badRequest' });
      }

      const game = roomManager.getRoom(socketData.roomCode);
      if (!game) return ack({ ok: false, error: 'notFound' });

      const res = game.startGame(socketData.playerId);
      if ('error' in res) {
        return ack({ ok: false, error: res.error });
      }

      ack({ ok: true });
      broadcastGameState(io, game);
    });

    // -----------------------------------------------------------
    // room:rematch
    // -----------------------------------------------------------
    socket.on('room:rematch', (_payload, ack) => {
      if (typeof ack !== 'function') return;
      if (!socketData.roomCode || !socketData.playerId) {
        return ack({ ok: false, error: 'badRequest' });
      }

      const game = roomManager.getRoom(socketData.roomCode);
      if (!game) return ack({ ok: false, error: 'notFound' });

      const res = game.rematch(socketData.playerId);
      if ('error' in res) {
        return ack({ ok: false, error: res.error });
      }

      ack({ ok: true });
      broadcastGameState(io, game);
    });

    // -----------------------------------------------------------
    // room:leave
    // -----------------------------------------------------------
    socket.on('room:leave', (_payload, ack) => {
      if (typeof ack !== 'function') return;
      if (!socketData.roomCode || !socketData.playerId) {
        return ack({ ok: false, error: 'badRequest' });
      }

      const game = roomManager.getRoom(socketData.roomCode);
      if (!game) return ack({ ok: false, error: 'notFound' });

      const { destroyed } = game.removePlayer(socketData.playerId);
      socket.leave(socketData.roomCode);

      if (destroyed) {
        roomManager.deleteRoom(socketData.roomCode);
      } else {
        broadcastGameState(io, game);
      }

      socketData.roomCode = undefined;
      socketData.playerId = undefined;
      ack({ ok: true });
    });

    // -----------------------------------------------------------
    // action:submit
    // -----------------------------------------------------------
    socket.on('action:submit', (payload, ack) => {
      if (typeof ack !== 'function') return;
      if (!socketData.roomCode || !socketData.playerId) {
        return ack({ ok: false, error: 'badRequest' });
      }

      if (!socketData.rateLimiter.checkAction()) {
        return ack({ ok: false, error: 'rateLimited' });
      }

      const parsed = ActionSubmitSchema.safeParse(payload);
      if (!parsed.success) {
        return ack({ ok: false, error: 'badRequest' });
      }

      const game = roomManager.getRoom(socketData.roomCode);
      if (!game) return ack({ ok: false, error: 'notFound' });

      const res = game.submitAction(socketData.playerId, parsed.data.kind, parsed.data.targetId);
      if ('error' in res) {
        return ack({ ok: false, error: res.error });
      }

      ack({ ok: true });
      // Emit updated state to caller immediately so pendingAction reflects selection
      socket.emit('state', projectFor(game, socketData.playerId));
    });

    // -----------------------------------------------------------
    // vote:cast
    // -----------------------------------------------------------
    socket.on('vote:cast', (payload, ack) => {
      if (typeof ack !== 'function') return;
      if (!socketData.roomCode || !socketData.playerId) {
        return ack({ ok: false, error: 'badRequest' });
      }

      if (!socketData.rateLimiter.checkAction()) {
        return ack({ ok: false, error: 'rateLimited' });
      }

      const parsed = VoteCastSchema.safeParse(payload);
      if (!parsed.success) {
        return ack({ ok: false, error: 'badRequest' });
      }

      const game = roomManager.getRoom(socketData.roomCode);
      if (!game) return ack({ ok: false, error: 'notFound' });

      const res = game.castVote(socketData.playerId, parsed.data.targetId);
      if ('error' in res) {
        return ack({ ok: false, error: res.error });
      }

      ack({ ok: true });
      // Emit updated state to caller so myVote reflects selection
      socket.emit('state', projectFor(game, socketData.playerId));
    });

    // -----------------------------------------------------------
    // mayor:decide
    // -----------------------------------------------------------
    socket.on('mayor:decide', (payload, ack) => {
      if (typeof ack !== 'function') return;
      if (!socketData.roomCode || !socketData.playerId) {
        return ack({ ok: false, error: 'badRequest' });
      }

      const parsed = MayorDecideSchema.safeParse(payload);
      if (!parsed.success) {
        return ack({ ok: false, error: 'badRequest' });
      }

      const game = roomManager.getRoom(socketData.roomCode);
      if (!game) return ack({ ok: false, error: 'notFound' });

      const res = game.mayorDecide(socketData.playerId, parsed.data.targetId);
      if ('error' in res) {
        return ack({ ok: false, error: res.error });
      }

      ack({ ok: true });
      broadcastGameState(io, game);
    });

    // -----------------------------------------------------------
    // chat:send
    // -----------------------------------------------------------
    socket.on('chat:send', (payload, ack) => {
      if (typeof ack !== 'function') return;
      if (!socketData.roomCode || !socketData.playerId) {
        return ack({ ok: false, error: 'badRequest' });
      }

      if (!socketData.rateLimiter.checkChat()) {
        return ack({ ok: false, error: 'rateLimited' });
      }

      const parsed = ChatSendSchema.safeParse(payload);
      if (!parsed.success) {
        return ack({ ok: false, error: 'badRequest' });
      }

      const game = roomManager.getRoom(socketData.roomCode);
      if (!game) return ack({ ok: false, error: 'notFound' });

      const sender = game.getPlayer(socketData.playerId);
      if (!sender) return ack({ ok: false, error: 'notAllowed' });

      const { channel, text } = parsed.data;
      const isMafia = sender.role ? isMafiaRole(sender.role) : false;

      // Check permissions per D18:
      // Lobby and gameOver: public chat open to all.
      // Discussion and voting: public chat open to alive, not silenced.
      // Night: mafia chat only.
      // All other phases: no chat.
      if (channel === 'public') {
        const canPublic =
          game.phase === 'lobby' ||
          game.phase === 'gameOver' ||
          ((game.phase === 'discussion' || game.phase === 'voting') &&
            sender.status === 'alive' &&
            !sender.silenced);

        if (!canPublic) return ack({ ok: false, error: 'notAllowed' });
      } else if (channel === 'mafia') {
        const canMafia = game.phase === 'night' && isMafia && sender.status === 'alive';
        if (!canMafia) return ack({ ok: false, error: 'notAllowed' });
      }

      const msg = {
        id: Math.random().toString(36).substring(2, 9),
        channel,
        from: sender.id,
        nickname: sender.nickname,
        text,
        ts: game.clock.now(),
      };
      game.chatHistory.push(msg);

      ack({ ok: true });

      // Deliver message only to authorized recipients
      for (const p of game.getAllPlayers()) {
        if (!p.connected || !p.socketId) continue;
        const recipientSocket = io.sockets.sockets.get(p.socketId);
        if (!recipientSocket) continue;

        if (channel === 'public') {
          // Public chat delivered to all in room
          recipientSocket.emit('chat', msg);
        } else if (channel === 'mafia') {
          // Mafia chat delivered only to alive mafia
          const recIsMafia = p.role ? isMafiaRole(p.role) : false;
          if (recIsMafia && p.status === 'alive') {
            recipientSocket.emit('chat', msg);
          }
        }
      }
    });

    // -----------------------------------------------------------
    // voice:token
    // -----------------------------------------------------------
    socket.on('voice:token', async (payload, ack) => {
      if (typeof ack !== 'function') return;
      if (!socketData.roomCode || !socketData.playerId) {
        return ack({ ok: false, error: 'badRequest' });
      }

      if (!config.LIVEKIT_URL) {
        return ack({ ok: false, error: 'voiceUnavailable' });
      }

      if (!socketData.rateLimiter.checkVoice()) {
        return ack({ ok: false, error: 'rateLimited' });
      }

      const parsed = VoiceTokenSchema.safeParse(payload);
      if (!parsed.success) {
        return ack({ ok: false, error: 'badRequest' });
      }

      const game = roomManager.getRoom(socketData.roomCode);
      if (!game) return ack({ ok: false, error: 'notFound' });

      const player = game.getPlayer(socketData.playerId);
      if (!player) return ack({ ok: false, error: 'notAllowed' });

      const { channel } = parsed.data;
      const isMafia = player.role ? isMafiaRole(player.role) : false;

      if (channel === 'mafia') {
        if (!isMafia || player.status !== 'alive' || game.phase === 'lobby') {
          return ack({ ok: false, error: 'notAllowed' });
        }
      }

      const canPublishNow =
        channel === 'public'
          ? (game.phase === 'lobby' || game.phase === 'discussion' || game.phase === 'gameOver') &&
            player.status !== 'dead' &&
            !player.silenced
          : isMafia && player.status === 'alive' && game.phase === 'night';

      try {
        const roomName = `ontorale-${game.roomCode}-${channel === 'public' ? 'pub' : 'maf'}`;
        const tokenRes = await game.voiceProvider.issueToken(
          roomName,
          player.id,
          player.nickname,
          canPublishNow,
        );
        ack({ ok: true, data: tokenRes });
      } catch {
        ack({ ok: false, error: 'voiceUnavailable' });
      }
    });

    // -----------------------------------------------------------
    // voice:ready
    // -----------------------------------------------------------
    socket.on('voice:ready', async (payload, ack) => {
      if (typeof ack !== 'function') return;
      if (!socketData.roomCode || !socketData.playerId) {
        return ack({ ok: false, error: 'badRequest' });
      }

      const parsed = VoiceReadySchema.safeParse(payload);
      if (!parsed.success) {
        return ack({ ok: false, error: 'badRequest' });
      }

      const game = roomManager.getRoom(socketData.roomCode);
      if (game) {
        await game.syncVoicePermissions();
      }

      ack({ ok: true });
    });

    // -----------------------------------------------------------
    // disconnect
    // -----------------------------------------------------------
    socket.on('disconnect', () => {
      if (!socketData.roomCode || !socketData.playerId) return;

      const game = roomManager.getRoom(socketData.roomCode);
      if (!game) return;

      const player = game.getPlayer(socketData.playerId);
      if (player && player.socketId === socket.id) {
        player.socketId = null;
        const { destroyed } = game.removePlayer(socketData.playerId);
        if (destroyed) {
          roomManager.deleteRoom(socketData.roomCode);
        } else {
          broadcastGameState(io, game);
        }
      }
    });
  });
}

function broadcastGameState(io: Server, game: Game): void {
  for (const player of game.getAllPlayers()) {
    if (player.connected && player.socketId) {
      const playerSocket = io.sockets.sockets.get(player.socketId);
      if (playerSocket) {
        const state = projectFor(game, player.id);
        playerSocket.emit('state', state);
      }
    }
  }
}

function sendChatHistory(socket: Socket, game: Game, playerId: string): void {
  const player = game.getPlayer(playerId);
  if (!player) return;

  const isMafia = player.role ? isMafiaRole(player.role) : false;
  const visible = game.chatHistory.filter((m) => {
    if (m.channel === 'public') return true;
    if (m.channel === 'mafia') {
      return isMafia;
    }
    return false;
  });

  socket.emit('chat:history', visible);
}
