import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { io as ioc, type Socket as ClientSocket } from 'socket.io-client';
import type { AddressInfo } from 'node:net';
import request from 'supertest';
import { createServer, type ServerInstance } from '../../src/app';
import { loadConfig } from '../../src/config';
import { FakeClock } from '../../src/game/clock';
import { SeededRng } from '../../src/util/random';
import { FakeVoiceProvider } from '../../src/voice/FakeVoiceProvider';
import type { ClientState } from '@ontorale/shared';

function createClient(port: number): Promise<ClientSocket> {
  const socket = ioc(`http://127.0.0.1:${port}`, {
    transports: ['websocket'],
    forceNew: true,
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

function emitWithAck<T = Record<string, unknown>>(
  socket: ClientSocket,
  event: string,
  payload?: unknown,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for ack on ${event}`)), 3000);
    socket.emit(event, payload, (res: T) => {
      clearTimeout(timer);
      resolve(res);
    });
  });
}

function waitForEvent<T = Record<string, unknown>>(
  socket: ClientSocket,
  event: string,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for event ${event}`)), 3000);
    socket.once(event, (data: T) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

describe('Integration Scenarios 1 & 2', () => {
  let serverInstance: ServerInstance;
  let port: number;
  let fakeClock: FakeClock;
  let seededRng: SeededRng;
  let fakeVoice: FakeVoiceProvider;
  const openSockets: ClientSocket[] = [];

  beforeEach(async () => {
    fakeClock = new FakeClock();
    seededRng = new SeededRng(42);
    fakeVoice = new FakeVoiceProvider();

    const config = loadConfig({
      NODE_ENV: 'test',
      PORT: '0',
      MAFIA_WIN_MODE: 'plusOne',
      TIMER_SCALE: '1',
    });

    serverInstance = createServer(config, {
      clock: fakeClock,
      rng: seededRng,
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

  it('verifies /healthz endpoint', async () => {
    const res = await request(serverInstance.app).get('/healthz');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      ok: true,
      activeGames: 0,
      rooms: 0,
    });
  });

  // Scenario 1: create / join / leave / host transfer / room full / duplicate nickname
  it('Scenario 1: create, join, duplicate nickname, room full, leave, host transfer, resume', async () => {
    const hostSocket = await createClient(port);
    openSockets.push(hostSocket);

    // 1. Create Room
    const statePromise0 = waitForEvent<ClientState>(hostSocket, 'state');
    const createRes = await emitWithAck(hostSocket, 'room:create', { nickname: 'HostPlayer' });
    expect(createRes.ok).toBe(true);
    const { roomCode, playerId: hostId, sessionToken: hostToken } = createRes.data;
    expect(roomCode).toHaveLength(6);
    expect(hostId).toBeDefined();
    expect(hostToken).toBeDefined();

    // Verify initial state received by host
    const hostState: ClientState = await statePromise0;
    expect(hostState.roomCode).toBe(roomCode);
    expect(hostState.me.isHost).toBe(true);
    expect(hostState.players).toHaveLength(1);
    expect(hostState.players[0].nickname).toBe('HostPlayer');

    // 2. Duplicate nickname rejected
    const dupSocket = await createClient(port);
    openSockets.push(dupSocket);
    const dupRes = await emitWithAck(dupSocket, 'room:join', {
      roomCode,
      nickname: 'hostplayer', // case insensitive check
    });
    expect(dupRes.ok).toBe(false);
    expect(dupRes.error).toBe('nicknameTaken');

    // 3. Join second player
    const p2Socket = await createClient(port);
    openSockets.push(p2Socket);
    const p2Res = await emitWithAck(p2Socket, 'room:join', {
      roomCode,
      nickname: 'Player2',
    });
    expect(p2Res.ok).toBe(true);
    const { playerId: p2Id } = p2Res.data;
    expect(p2Id).toBeDefined();

    // 4. Fill room up to 15 players
    for (let i = 3; i <= 15; i++) {
      const sock = await createClient(port);
      openSockets.push(sock);
      const joinRes = await emitWithAck(sock, 'room:join', {
        roomCode,
        nickname: `Player${i}`,
      });
      expect(joinRes.ok).toBe(true);
    }

    // 5. 16th player rejected with roomFull
    const p16Socket = await createClient(port);
    openSockets.push(p16Socket);
    const p16Res = await emitWithAck(p16Socket, 'room:join', {
      roomCode,
      nickname: 'Player16',
    });
    expect(p16Res.ok).toBe(false);
    expect(p16Res.error).toBe('roomFull');

    // 6. Host leaves -> host transfer to Player2 (earliest joined remaining player)
    const statePromise = waitForEvent<ClientState>(p2Socket, 'state');
    const leaveRes = await emitWithAck(hostSocket, 'room:leave');
    expect(leaveRes.ok).toBe(true);

    const updatedP2State = await statePromise;
    expect(updatedP2State.players).toHaveLength(14);
    expect(updatedP2State.players.find((p) => p.id === hostId)).toBeUndefined();
    // Player2 is now host
    const p2Player = updatedP2State.players.find((p) => p.id === p2Id);
    expect(p2Player?.isHost).toBe(true);
    expect(updatedP2State.me.isHost).toBe(true);

    // 7. Resume in lobby with session token
    const resumeSocket = await createClient(port);
    openSockets.push(resumeSocket);
    const resumeRes = await emitWithAck(resumeSocket, 'room:resume', {
      roomCode,
      sessionToken: p2Res.data.sessionToken,
    });
    expect(resumeRes.ok).toBe(true);
    expect(resumeRes.data.playerId).toBe(p2Id);
  });

  // Scenario 2: start rejected for < 6 players and for invalid role config
  it('Scenario 2: start rejected for < 6 players and for invalid role config', async () => {
    const hostSocket = await createClient(port);
    openSockets.push(hostSocket);

    const createRes = await emitWithAck(hostSocket, 'room:create', { nickname: 'Host' });
    const { roomCode } = createRes.data;

    // 1. Host tries to start with only 1 player (< 6)
    const startRes1 = await emitWithAck(hostSocket, 'room:start');
    expect(startRes1.ok).toBe(false);
    expect(startRes1.error).toBe('playerCountInvalid');

    // 2. Add players up to 5 players (< 6)
    for (let i = 2; i <= 5; i++) {
      const sock = await createClient(port);
      openSockets.push(sock);
      await emitWithAck(sock, 'room:join', { roomCode, nickname: `P${i}` });
    }

    const startRes2 = await emitWithAck(hostSocket, 'room:start');
    expect(startRes2.ok).toBe(false);
    expect(startRes2.error).toBe('playerCountInvalid');

    // 3. Add 6th player (now 6 players)
    const sock6 = await createClient(port);
    openSockets.push(sock6);
    await emitWithAck(sock6, 'room:join', { roomCode, nickname: 'P6' });

    // 4. Update settings to invalid role config for 6 players (e.g. silencer: true)
    // For 6 players, total mafia = 1. If silencer is enabled, killers = 1 - 1 = 0 < 1 => invalid!
    const settingsRes = await emitWithAck(hostSocket, 'room:settings', {
      discussionSec: 180,
      voteSec: 60,
      optional: {
        detective: true,
        mayor: true,
        silencer: true, // not valid for 6 players
        confuser: false,
      },
    });
    expect(settingsRes.ok).toBe(true);

    // 5. Try to start with 6 players and invalid role config
    const startRes3 = await emitWithAck(hostSocket, 'room:start');
    expect(startRes3.ok).toBe(false);
    expect(startRes3.error).toBe('roleConfigInvalid');

    // 6. Reset to valid config and start successfully
    const validSettingsRes = await emitWithAck(hostSocket, 'room:settings', {
      discussionSec: 180,
      voteSec: 60,
      optional: {
        detective: true,
        mayor: true,
        silencer: false,
        confuser: false,
      },
    });
    expect(validSettingsRes.ok).toBe(true);

    const statePromise = waitForEvent<ClientState>(hostSocket, 'state');
    const validStartRes = await emitWithAck(hostSocket, 'room:start');
    expect(validStartRes.ok).toBe(true);

    // Game is now in night phase
    const nightState: ClientState = await statePromise;
    expect(nightState.phase).toBe('night');
    expect(nightState.round).toBe(1);
    expect(nightState.phaseEndsAt).toBeDefined();
  });
});
