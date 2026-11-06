import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { io as ioc, type Socket as ClientSocket } from 'socket.io-client';
import type { AddressInfo } from 'node:net';
import { createServer, type ServerInstance } from '../../src/app';
import { loadConfig } from '../../src/config';
import { FakeClock } from '../../src/game/clock';
import { FakeVoiceProvider } from '../../src/voice/FakeVoiceProvider';

function createClient(port: number, ip?: string): Promise<ClientSocket> {
  const socket = ioc(`http://127.0.0.1:${port}`, {
    transports: ['websocket'],
    forceNew: true,
    extraHeaders: ip ? { 'x-forwarded-for': ip } : undefined,
  });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Socket connection timed out')), 2000);
    socket.on('connect', () => {
      clearTimeout(timer);
      resolve(socket);
    });
    socket.on('connect_error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

/* eslint-disable @typescript-eslint/no-explicit-any */
interface AckResponse {
  ok: boolean;
  data?: any;
  error?: string;
  [key: string]: any;
}

function emitWithAck<T = AckResponse>(
  socket: ClientSocket,
  event: string,
  payload?: unknown,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for ack on ${event}`)), 5000);
    socket.emit(event, payload, (res: T) => {
      clearTimeout(timer);
      resolve(res);
    });
  });
}

describe('Integration Scenario 6: 15-Player Game across 5 Concurrent Rooms', () => {
  let serverInstance: ServerInstance;
  let port: number;
  let fakeClock: FakeClock;
  let fakeVoice: FakeVoiceProvider;
  const openSockets: ClientSocket[] = [];

  beforeEach(async () => {
    fakeClock = new FakeClock();
    fakeVoice = new FakeVoiceProvider();

    const config = loadConfig({
      NODE_ENV: 'test',
      PORT: '0',
      MAX_ROOMS: '20',
      MAFIA_WIN_MODE: 'plusOne',
      TIMER_SCALE: '1',
    });

    serverInstance = createServer(config, {
      clock: fakeClock,
      voiceProvider: fakeVoice,
    });

    await new Promise<void>((resolve) => {
      serverInstance.httpServer.listen(0, () => {
        port = (serverInstance.httpServer.address() as AddressInfo).port;
        resolve();
      });
    });
  });

  afterEach(async () => {
    for (const socket of openSockets) {
      if (socket.connected) {
        socket.disconnect();
      }
    }
    openSockets.length = 0;

    await new Promise<void>((resolve) => {
      serverInstance.io.close(() => {
        serverInstance.httpServer.close(() => resolve());
      });
    });
  });

  it('runs 5 concurrent rooms with 15 players each with zero cross-room leakage', async () => {
    interface RoomContext {
      roomCode: string;
      sockets: ClientSocket[];
      receivedChat: string[];
    }

    const rooms: RoomContext[] = [];

    // Create 5 rooms
    for (let r = 0; r < 5; r++) {
      const hostSocket = await createClient(port, `10.0.0.${r + 1}`);
      openSockets.push(hostSocket);

      const createRes = await emitWithAck<{ ok: boolean; data: { roomCode: string } }>(
        hostSocket,
        'room:create',
        { nickname: `Host_R${r}` },
      );
      expect(createRes.ok).toBe(true);
      const roomCode = createRes.data.roomCode;

      const roomCtx: RoomContext = {
        roomCode,
        sockets: [hostSocket],
        receivedChat: [],
      };

      // 14 more players join each room
      for (let p = 2; p <= 15; p++) {
        const sock = await createClient(port);
        openSockets.push(sock);
        const joinRes = await emitWithAck<{ ok: boolean }>(sock, 'room:join', {
          roomCode,
          nickname: `P${p}_R${r}`,
        });
        expect(joinRes.ok).toBe(true);
        roomCtx.sockets.push(sock);
      }

      // Attach chat listeners to all sockets in this room
      for (const s of roomCtx.sockets) {
        s.on('chat', (msg: { text: string }) => {
          roomCtx.receivedChat.push(msg.text);
        });
      }

      rooms.push(roomCtx);
    }

    expect(serverInstance.roomManager.roomsCount()).toBe(5);

    // Start all 5 games
    for (const roomCtx of rooms) {
      const host = roomCtx.sockets[0];
      const startRes = await emitWithAck<{ ok: boolean }>(host, 'room:start');
      expect(startRes.ok).toBe(true);

      const game = serverInstance.roomManager.getRoom(roomCtx.roomCode)!;
      expect(game.phase).toBe('night');
      expect(game.getAllPlayers()).toHaveLength(15);
      const mafiaCount = game
        .getAllPlayers()
        .filter(
          (p) => p.role === 'killer' || p.role === 'silencer' || p.role === 'confuser',
        ).length;
      expect(mafiaCount).toBe(4); // 15 players has 4 mafia
    }

    expect(serverInstance.roomManager.activeGamesCount()).toBe(5);

    // Cross-room leakage check:
    // Move Room 0 to discussion and send chat
    const r0Game = serverInstance.roomManager.getRoom(rooms[0].roomCode)!;
    fakeClock.advanceBy(120_000); // night
    fakeClock.advanceBy(10_000); // nightResult -> discussion
    expect(r0Game.phase).toBe('discussion');

    const testMessage = 'Secret_Message_From_Room_0';
    await emitWithAck(rooms[0].sockets[0], 'chat:send', {
      channel: 'public',
      text: testMessage,
    });

    // Wait a brief tick for socket emission
    await new Promise((r) => setTimeout(r, 50));

    // Room 0 sockets received the message
    expect(rooms[0].receivedChat).toContain(testMessage);

    // Other rooms (1..4) NEVER received the message
    for (let i = 1; i < 5; i++) {
      expect(rooms[i].receivedChat).not.toContain(testMessage);
    }
  });
});
