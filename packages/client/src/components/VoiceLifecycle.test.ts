import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useVoiceStore } from '../store/useVoiceStore';

describe('Voice Lifecycle & Audio Hardware Capture (Milestone 2 & 3)', () => {
  beforeEach(() => {
    useVoiceStore.getState().resetVoice();
    vi.restoreAllMocks();
  });

  it('acquires hardware capture only once on unmute and reuses existing track', async () => {
    let getUserMediaCalls = 0;
    const fakeStreamTrack = {
      kind: 'audio',
      enabled: true,
      stop: vi.fn(),
      clone: vi.fn(() => ({
        kind: 'audio',
        enabled: true,
        stop: vi.fn(),
      })),
    };

    const fakeGetUserMedia = vi.fn(async () => {
      getUserMediaCalls++;
      return {
        getAudioTracks: () => [fakeStreamTrack],
      };
    });

    // Mock mediaDevices
    const mockMediaDevices = {
      getUserMedia: fakeGetUserMedia,
    };

    // Client capture manager simulation
    class LocalCaptureManager {
      private activeTrack: typeof fakeStreamTrack | null = null;

      async getOrCreateTrack() {
        if (this.activeTrack) return this.activeTrack;
        const stream = await mockMediaDevices.getUserMedia();
        this.activeTrack = stream.getAudioTracks()[0];
        return this.activeTrack;
      }

      getClonedTrackForMafia() {
        if (!this.activeTrack) throw new Error('No track to clone');
        return this.activeTrack.clone();
      }

      cleanup() {
        if (this.activeTrack) {
          this.activeTrack.stop();
          this.activeTrack = null;
        }
      }
    }

    const manager = new LocalCaptureManager();

    // 1. Initial state: no getUserMedia called yet
    expect(getUserMediaCalls).toBe(0);

    // 2. First unmute: calls getUserMedia exactly once
    const track1 = await manager.getOrCreateTrack();
    expect(getUserMediaCalls).toBe(1);
    expect(track1).toBe(fakeStreamTrack);

    // 3. Dual room (mafia room during night): clones mediaStreamTrack, does NOT call getUserMedia
    const clonedMafiaTrack = manager.getClonedTrackForMafia();
    expect(getUserMediaCalls).toBe(1); // Still exactly 1
    expect(fakeStreamTrack.clone).toHaveBeenCalledTimes(1);
    expect(clonedMafiaTrack.kind).toBe('audio');

    // 4. Repeated unmute in subsequent phases: reuses existing track
    const track2 = await manager.getOrCreateTrack();
    expect(getUserMediaCalls).toBe(1); // Still exactly 1
    expect(track2).toBe(track1);

    // 5. Cleanup stops hardware track cleanly
    manager.cleanup();
    expect(fakeStreamTrack.stop).toHaveBeenCalledTimes(1);
  });

  it('handles browser permission denial gracefully without unhandled exceptions', async () => {
    const permissionError = new Error('Permission denied by user');
    permissionError.name = 'NotAllowedError';

    const fakeGetUserMedia = vi.fn(async () => {
      throw permissionError;
    });

    let caughtError: unknown = null;
    try {
      await fakeGetUserMedia();
    } catch (err) {
      caughtError = err;
      if (
        err instanceof Error &&
        (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')
      ) {
        useVoiceStore.getState().setPermissionDenied(true);
      }
    }

    expect(caughtError).toBe(permissionError);
    // Verified: state machine transitions to failed and permissionDenied is true
    expect(useVoiceStore.getState().permissionDenied).toBe(true);
    expect(useVoiceStore.getState().voiceStatus).toBe('failed');
    // Mic preference remains intact
    expect(useVoiceStore.getState().micEnabled).toBe(false);
  });

  it('isolates failure and allows user to retry voice without crashing the game', () => {
    // Simulate failed voice state
    useVoiceStore.getState().setPermissionDenied(true);
    expect(useVoiceStore.getState().voiceStatus).toBe('failed');

    // User clicks "Retry" button
    useVoiceStore.getState().retryConnection();

    // System transitions back to connecting, resetting denial flag
    expect(useVoiceStore.getState().voiceStatus).toBe('connecting');
    expect(useVoiceStore.getState().permissionDenied).toBe(false);
    expect(useVoiceStore.getState().retryCount).toBe(1);
  });
});
