import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { io as ioc, type Socket as ClientSocket } from 'socket.io-client';
import type { AddressInfo } from 'node:net';
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

describe('Integration Scenarios 3 & 4', () => {
  let serverInstance: ServerInstance;
  let port: number;
  let fakeClock: FakeClock;
  let seededRng: SeededRng;
  let fakeVoice: FakeVoiceProvider;
  const openSockets: ClientSocket[] = [];

  beforeEach(async () => {
    fakeClock = new FakeClock();
    seededRng = new SeededRng(123);
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

  // Scenario 3: a scripted full game where citizens win by votes
  it('Scenario 3: citizens win by votes', async () => {
    const sockets: ClientSocket[] = [];
    const playerIds: string[] = [];

    // Host creates room
    const host = await createClient(port);
    sockets.push(host);
    openSockets.push(host);

    const hostStateP = waitForEvent<ClientState>(host, 'state');
    const createRes = await emitWithAck<{
      ok: boolean;
      data: { roomCode: string; playerId: string };
    }>(host, 'room:create', { nickname: 'P1' });
    expect(createRes.ok).toBe(true);
    const { roomCode, playerId: hostId } = createRes.data;
    playerIds.push(hostId);
    await hostStateP;

    // 5 players join
    for (let i = 2; i <= 6; i++) {
      const sock = await createClient(port);
      sockets.push(sock);
      openSockets.push(sock);
      const joinRes = await emitWithAck<{ ok: boolean; data: { playerId: string } }>(
        sock,
        'room:join',
        { roomCode, nickname: `P${i}` },
      );
      expect(joinRes.ok).toBe(true);
      playerIds.push(joinRes.data.playerId);
    }

    // Start game
    const startP = waitForEvent<ClientState>(host, 'state');
    const startRes = await emitWithAck<{ ok: boolean }>(host, 'room:start');
    expect(startRes.ok).toBe(true);
    await startP;

    // Identify player roles from game instance
    const game = serverInstance.roomManager.getRoom(roomCode)!;
    expect(game.phase).toBe('night');

    const killer = game.getAllPlayers().find((p) => p.role === 'killer')!;
    const killerSocket = sockets[playerIds.indexOf(killer.id)];

    // Night 1: killer abstains, doctor self protects, police holds fire
    await emitWithAck(killerSocket, 'action:submit', { kind: 'kill', targetId: null });

    // Advance clock past night (120s) + nightResult (10s) + discussion (180s) -> voting phase
    fakeClock.advanceBy(120_000); // -> nightResult
    expect(game.phase).toBe('nightResult');

    fakeClock.advanceBy(10_000); // -> discussion
    expect(game.phase).toBe('discussion');

    fakeClock.advanceBy(180_000); // -> voting
    expect(game.phase).toBe('voting');

    // All alive players vote for the killer
    for (let i = 0; i < sockets.length; i++) {
      const p = game.getPlayer(playerIds[i]);
      if (p && p.status === 'alive' && p.id !== killer.id) {
        await emitWithAck(sockets[i], 'vote:cast', { targetId: killer.id });
      }
    }

    // Advance clock past voting (60s) -> voteResult
    fakeClock.advanceBy(60_000);
    expect(game.phase).toBe('voteResult');
    expect(killer.status).toBe('dead');
    expect(killer.revealedRole).toBe('killer');

    // Advance clock past voteResult (10s) -> gameOver (win check)
    fakeClock.advanceBy(10_000);
    expect(game.phase).toBe('gameOver');
    expect(game.winner).toBe('citizens');

    // Host triggers rematch from gameOver
    const rematchRes = await emitWithAck<{ ok: boolean }>(host, 'room:rematch');
    expect(rematchRes.ok).toBe(true);
    expect(game.phase).toBe('lobby');

    // Test voice:ready
    const readyRes = await emitWithAck<{ ok: boolean }>(host, 'voice:ready', { channel: 'public' });
    expect(readyRes.ok).toBe(true);
  });

  // Scenario 4: a scripted full game where mafia wins by kills
  it('Scenario 4: mafia wins by kills', async () => {
    const sockets: ClientSocket[] = [];
    const playerIds: string[] = [];

    const host = await createClient(port);
    sockets.push(host);
    openSockets.push(host);

    const createRes = await emitWithAck<{
      ok: boolean;
      data: { roomCode: string; playerId: string };
    }>(host, 'room:create', { nickname: 'P1' });
    const { roomCode, playerId: hostId } = createRes.data;
    playerIds.push(hostId);

    for (let i = 2; i <= 6; i++) {
      const sock = await createClient(port);
      sockets.push(sock);
      openSockets.push(sock);
      const joinRes = await emitWithAck<{ ok: boolean; data: { playerId: string } }>(
        sock,
        'room:join',
        { roomCode, nickname: `P${i}` },
      );
      playerIds.push(joinRes.data.playerId);
    }

    const startP = waitForEvent<ClientState>(host, 'state');
    await emitWithAck(host, 'room:start');
    await startP;

    const game = serverInstance.roomManager.getRoom(roomCode)!;
    const killer = game.getAllPlayers().find((p) => p.role === 'killer')!;
    const killerSocket = sockets[playerIds.indexOf(killer.id)];
    const nonMafia = game.getAllPlayers().filter((p) => p.id !== killer.id);

    // Night 1: killer kills nonMafia[0]
    await emitWithAck(killerSocket, 'action:submit', { kind: 'kill', targetId: nonMafia[0].id });
    fakeClock.advanceBy(120_000); // night resolves: nonMafia[0] dies
    expect(nonMafia[0].status).toBe('dead');

    fakeClock.advanceBy(10_000); // discussion
    fakeClock.advanceBy(180_000); // voting
    // Day 1 vote: all abstain
    fakeClock.advanceBy(60_000); // voteResult
    fakeClock.advanceBy(10_000); // night round 2
    expect(game.phase).toBe('night');
    expect(game.round).toBe(2);

    // Night 2: killer kills nonMafia[1]
    await emitWithAck(killerSocket, 'action:submit', { kind: 'kill', targetId: nonMafia[1].id });
    fakeClock.advanceBy(120_000); // night resolves: nonMafia[1] dies

    fakeClock.advanceBy(10_000); // discussion
    fakeClock.advanceBy(180_000); // voting
    fakeClock.advanceBy(60_000); // voteResult
    fakeClock.advanceBy(10_000); // night round 3

    // Night 3: killer kills nonMafia[2]
    await emitWithAck(killerSocket, 'action:submit', { kind: 'kill', targetId: nonMafia[2].id });
    fakeClock.advanceBy(120_000);

    fakeClock.advanceBy(10_000);
    fakeClock.advanceBy(180_000);
    fakeClock.advanceBy(60_000);
    fakeClock.advanceBy(10_000); // night round 4

    // Night 4: killer kills nonMafia[3]. Alive mafia: 1, alive non-mafia: 1. In plusOne: 1 >= 1+1 (false).
    await emitWithAck(killerSocket, 'action:submit', { kind: 'kill', targetId: nonMafia[3].id });
    fakeClock.advanceBy(120_000);

    fakeClock.advanceBy(10_000);
    fakeClock.advanceBy(180_000);
    fakeClock.advanceBy(60_000);
    fakeClock.advanceBy(10_000); // night round 5

    // Night 5: killer kills nonMafia[4]. Alive mafia: 1, alive non-mafia: 0. 1 >= 0+1 -> Mafia wins!
    await emitWithAck(killerSocket, 'action:submit', { kind: 'kill', targetId: nonMafia[4].id });
    fakeClock.advanceBy(120_000); // night resolves -> gameOver!

    expect(game.phase).toBe('gameOver');
    expect(game.winner).toBe('mafia');
  });
});
