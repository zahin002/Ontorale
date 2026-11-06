import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { io as ioc, type Socket as ClientSocket } from 'socket.io-client';
import type { AddressInfo } from 'node:net';
import { createServer, type ServerInstance } from '../../src/app';
import { loadConfig } from '../../src/config';
import { FakeClock } from '../../src/game/clock';
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
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for ack on ${event}`)), 3000);
    socket.emit(event, payload, (res: T) => {
      clearTimeout(timer);
      resolve(res);
    });
  });
}

describe('Integration Scenario 7: Malicious Client Attacks', () => {
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
      LIVEKIT_URL: 'wss://fake.livekit.cloud',
      LIVEKIT_API_KEY: 'test-key',
      LIVEKIT_API_SECRET: 'test-secret',
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

  it('rejects all malicious attempts and prevents unauthorized state changes', async () => {
    const sockets: ClientSocket[] = [];
    const playerIds: string[] = [];

    const host = await createClient(port);
    sockets.push(host);
    openSockets.push(host);

    const createRes = await emitWithAck<{
      ok: boolean;
      data: { roomCode: string; playerId: string };
    }>(host, 'room:create', { nickname: 'Host' });
    const { roomCode, playerId: hostId } = createRes.data;
    playerIds.push(hostId);

    for (let i = 2; i <= 6; i++) {
      const sock = await createClient(port);
      sockets.push(sock);
      openSockets.push(sock);
      const joinRes = await emitWithAck<{ ok: boolean; data: { playerId: string } }>(
        sock,
        'room:join',
        { roomCode, nickname: `Player${i}` },
      );
      playerIds.push(joinRes.data.playerId);
    }

    const game = serverInstance.roomManager.getRoom(roomCode)!;
    await emitWithAck(host, 'room:start');

    const citizen = game.getAllPlayers().find((p) => p.role === 'citizen')!;
    const citizenSocket = sockets[playerIds.indexOf(citizen.id)];
    const killer = game.getAllPlayers().find((p) => p.role === 'killer')!;
    const killerSocket = sockets[playerIds.indexOf(killer.id)];

    // 1. Forged player ID attempt:
    // Client passes extra fields attempting to impersonate another player; server uses authenticated socket identity
    const forgedRes = await emitWithAck<{ ok: boolean; error?: string }>(
      citizenSocket,
      'action:submit',
      {
        kind: 'kill',
        targetId: killer.id,
        playerId: killer.id, // malicious spoof attempt
      },
    );
    expect(forgedRes.ok).toBe(false);
    expect(forgedRes.error).toBe('notAllowed'); // citizen cannot submit 'kill'

    // 2. Action in wrong phase:
    // Move to discussion, then try to submit night action
    fakeClock.advanceBy(120_000); // night
    fakeClock.advanceBy(10_000); // nightResult -> discussion
    expect(game.phase).toBe('discussion');

    const wrongPhaseRes = await emitWithAck<{ ok: boolean; error?: string }>(
      killerSocket,
      'action:submit',
      {
        kind: 'kill',
        targetId: citizen.id,
      },
    );
    expect(wrongPhaseRes.ok).toBe(false);
    expect(wrongPhaseRes.error).toBe('wrongPhase');

    // 3. Dead player voting:
    citizen.status = 'dead';
    fakeClock.advanceBy(180_000); // discussion -> voting
    expect(game.phase).toBe('voting');

    const deadVoteRes = await emitWithAck<{ ok: boolean; error?: string }>(
      citizenSocket,
      'vote:cast',
      { targetId: killer.id },
    );
    expect(deadVoteRes.ok).toBe(false);
    expect(deadVoteRes.error).toBe('notAllowed');
    expect(game.getPendingVote(citizen.id)).toBeNull();

    // 4. Mafia chat as citizen:
    // Move to next night
    fakeClock.advanceBy(60_000); // voteResult
    fakeClock.advanceBy(10_000); // night round 2
    expect(game.phase).toBe('night');

    const citizen2 = game.getAllPlayers().find((p) => p.role !== 'killer' && p.status === 'alive')!;
    const citizen2Socket = sockets[playerIds.indexOf(citizen2.id)];

    const mafiaChatRes = await emitWithAck<{ ok: boolean; error?: string }>(
      citizen2Socket,
      'chat:send',
      {
        channel: 'mafia',
        text: 'Hello fellow mafia',
      },
    );
    expect(mafiaChatRes.ok).toBe(false);
    expect(mafiaChatRes.error).toBe('notAllowed');

    // 5. Requesting mafia voice token as citizen:
    const mafiaVoiceRes = await emitWithAck<{ ok: boolean; error?: string }>(
      citizen2Socket,
      'voice:token',
      { channel: 'mafia' },
    );
    expect(mafiaVoiceRes.ok).toBe(false);
    expect(mafiaVoiceRes.error).toBe('notAllowed');

    // 6. Oversized payload:
    const oversizedChatRes = await emitWithAck<{ ok: boolean; error?: string }>(
      killerSocket,
      'chat:send',
      {
        channel: 'mafia',
        text: 'A'.repeat(301),
      },
    );
    expect(oversizedChatRes.ok).toBe(false);
    expect(oversizedChatRes.error).toBe('badRequest');

    // Malformed JSON payload
    const malformedRes = await emitWithAck<{ ok: boolean; error?: string }>(
      killerSocket,
      'chat:send',
      {
        channel: 12345, // invalid type
        text: true,
      },
    );
    expect(malformedRes.ok).toBe(false);
    expect(malformedRes.error).toBe('badRequest');
  });
});
