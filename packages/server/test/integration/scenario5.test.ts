import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { io as ioc, type Socket as ClientSocket } from 'socket.io-client';
import type { AddressInfo } from 'node:net';
import { createServer, type ServerInstance } from '../../src/app';
import { loadConfig } from '../../src/config';
import { FakeClock } from '../../src/game/clock';
import { SeededRng } from '../../src/util/random';
import { FakeVoiceProvider } from '../../src/voice/FakeVoiceProvider';

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

describe('Integration Scenario 5: Mayor Tiebreak Outcomes', () => {
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

  async function setupLobbyWithMayor() {
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

    const game = serverInstance.roomManager.getRoom(roomCode)!;

    // Enable mayor in settings
    await emitWithAck(host, 'room:settings', {
      discussionSec: 180,
      voteSec: 60,
      optional: { detective: false, mayor: true, silencer: false, confuser: false },
    });

    await emitWithAck(host, 'room:start');

    // Find mayor
    const mayor = game.getAllPlayers().find((p) => p.role === 'mayor')!;
    const mayorSocket = sockets[playerIds.indexOf(mayor.id)];

    return { game, sockets, playerIds, mayor, mayorSocket };
  }

  // Outcome 1: Mayor chooses a player from the tied set -> that player eliminated
  it('Outcome 1: Mayor eliminates a player from tied candidates', async () => {
    const { game, sockets, playerIds, mayor, mayorSocket } = await setupLobbyWithMayor();

    // Fast-forward past night 1 to voting
    fakeClock.advanceBy(120_000); // night
    fakeClock.advanceBy(10_000); // nightResult
    fakeClock.advanceBy(180_000); // discussion -> voting
    expect(game.phase).toBe('voting');

    // Pick two non-mayor players to tie
    const nonMayors = game.getAllPlayers().filter((p) => p.id !== mayor.id && p.status === 'alive');
    const candA = nonMayors[0];
    const candB = nonMayors[1];

    // 1 vote for candA, 1 vote for candB
    await emitWithAck(sockets[playerIds.indexOf(candA.id)], 'vote:cast', { targetId: candB.id });
    await emitWithAck(sockets[playerIds.indexOf(candB.id)], 'vote:cast', { targetId: candA.id });

    // End voting timer (60s)
    fakeClock.advanceBy(60_000);
    expect(game.phase).toBe('mayorTiebreak');
    expect(game.tiedCandidates?.sort()).toEqual([candA.id, candB.id].sort());

    // Mayor chooses candA
    const decideRes = await emitWithAck<{ ok: boolean }>(mayorSocket, 'mayor:decide', {
      targetId: candA.id,
    });
    expect(decideRes.ok).toBe(true);

    expect(game.phase).toBe('voteResult');
    expect(candA.status).toBe('dead');
    expect(candA.revealedRole).toBe(candA.role);
    expect(candB.status).toBe('alive');
  });

  // Outcome 2: Mayor chooses nobody -> no elimination
  it('Outcome 2: Mayor explicitly chooses nobody (targetId = null)', async () => {
    const { game, sockets, playerIds, mayor, mayorSocket } = await setupLobbyWithMayor();

    fakeClock.advanceBy(120_000);
    fakeClock.advanceBy(10_000);
    fakeClock.advanceBy(180_000);
    expect(game.phase).toBe('voting');

    const nonMayors = game.getAllPlayers().filter((p) => p.id !== mayor.id && p.status === 'alive');
    const candA = nonMayors[0];
    const candB = nonMayors[1];

    await emitWithAck(sockets[playerIds.indexOf(candA.id)], 'vote:cast', { targetId: candB.id });
    await emitWithAck(sockets[playerIds.indexOf(candB.id)], 'vote:cast', { targetId: candA.id });

    fakeClock.advanceBy(60_000);
    expect(game.phase).toBe('mayorTiebreak');

    // Mayor decides nobody
    const decideRes = await emitWithAck<{ ok: boolean }>(mayorSocket, 'mayor:decide', {
      targetId: null,
    });
    expect(decideRes.ok).toBe(true);

    expect(game.phase).toBe('voteResult');
    expect(candA.status).toBe('alive');
    expect(candB.status).toBe('alive');
  });

  // Outcome 3: Mayor timeout -> nobody eliminated
  it('Outcome 3: Mayor decision times out after 20s -> nobody eliminated', async () => {
    const { game, sockets, playerIds, mayor } = await setupLobbyWithMayor();

    fakeClock.advanceBy(120_000);
    fakeClock.advanceBy(10_000);
    fakeClock.advanceBy(180_000);
    expect(game.phase).toBe('voting');

    const nonMayors = game.getAllPlayers().filter((p) => p.id !== mayor.id && p.status === 'alive');
    const candA = nonMayors[0];
    const candB = nonMayors[1];

    await emitWithAck(sockets[playerIds.indexOf(candA.id)], 'vote:cast', { targetId: candB.id });
    await emitWithAck(sockets[playerIds.indexOf(candB.id)], 'vote:cast', { targetId: candA.id });

    fakeClock.advanceBy(60_000);
    expect(game.phase).toBe('mayorTiebreak');

    // Advance clock past 20s mayor tiebreak duration
    fakeClock.advanceBy(20_000);

    expect(game.phase).toBe('voteResult');
    expect(candA.status).toBe('alive');
    expect(candB.status).toBe('alive');
  });
});
