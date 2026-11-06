import { describe, it, expect } from 'vitest';
import { RoomManager } from './RoomManager';
import { FakeClock } from '../game/clock';
import { FakeVoiceProvider } from '../voice/FakeVoiceProvider';
import { loadConfig } from '../config';

describe('RoomManager', () => {
  it('handles idle sweep, deletion and resume error cases', () => {
    const clock = new FakeClock();
    const voice = new FakeVoiceProvider();
    const config = loadConfig({ NODE_ENV: 'test', PORT: '0', MAX_ROOMS: '2' });
    const manager = new RoomManager(config, { clock, voiceProvider: voice });

    // 1. Create room
    const r1 = manager.createRoom('Host1');
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;

    // 2. Resume room errors
    expect(manager.resumeRoom('NONEXIST', 'tok')).toEqual({ ok: false, error: 'notFound' });
    expect(manager.resumeRoom(r1.roomCode, 'invalidToken')).toEqual({
      ok: false,
      error: 'badRequest',
    });

    // 3. Max rooms limit
    const r2 = manager.createRoom('Host2');
    expect(r2.ok).toBe(true);

    const r3 = manager.createRoom('Host3');
    expect(r3.ok).toBe(false);
    if (!r3.ok) {
      expect(r3.error).toBe('tooManyRooms');
    }

    // 4. Idle sweep deletes rooms after 30 min with no connected sockets
    const game1 = r1.game;
    const hostPlayer = game1.getPlayer(r1.playerId)!;
    hostPlayer.connected = false;

    // Advance clock by 31 minutes
    clock.advanceBy(31 * 60 * 1000);
    manager.idleCleanupSweep();

    expect(manager.getRoom(r1.roomCode)).toBeUndefined();
  });
});
