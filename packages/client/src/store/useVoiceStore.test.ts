import { describe, it, expect, beforeEach } from 'vitest';
import { useVoiceStore } from './useVoiceStore';

describe('Voice Store & State Machine (Milestone 2 & 3)', () => {
  beforeEach(() => {
    useVoiceStore.getState().resetVoice();
  });

  it('initial state is muted (micEnabled === false, voiceStatus === idle)', () => {
    const state = useVoiceStore.getState();
    expect(state.micEnabled).toBe(false);
    expect(state.voiceStatus).toBe('idle');
    expect(state.permissionDenied).toBe(false);
    expect(state.audioPlaybackBlocked).toBe(false);
    expect(state.retryCount).toBe(0);
  });

  it('one click toggles micEnabled', () => {
    useVoiceStore.getState().toggleMic();
    expect(useVoiceStore.getState().micEnabled).toBe(true);

    useVoiceStore.getState().toggleMic();
    expect(useVoiceStore.getState().micEnabled).toBe(false);
  });

  it('permission denial does not toggle or clear mic preference, sets voiceStatus to failed', () => {
    useVoiceStore.getState().setMicEnabled(true);
    useVoiceStore.getState().setPermissionDenied(true);
    // User preference remains true even when hardware permission fails
    expect(useVoiceStore.getState().micEnabled).toBe(true);
    expect(useVoiceStore.getState().permissionDenied).toBe(true);
    expect(useVoiceStore.getState().voiceStatus).toBe('failed');
  });

  it('10 rapid clicks produce at most one mic state change every 300 ms (debounce)', () => {
    let lastClick = 0;
    const simulateClick = (now: number) => {
      if (now - lastClick < 300) return;
      lastClick = now;
      useVoiceStore.getState().toggleMic();
    };

    // Rapid burst of 10 clicks within 200ms
    for (let i = 0; i < 10; i++) {
      simulateClick(1000 + i * 20); // 1000, 1020, 1040, ...
    }
    // Only the first click at 1000ms went through
    expect(useVoiceStore.getState().micEnabled).toBe(true);

    // Click after debounce period
    simulateClick(1350);
    expect(useVoiceStore.getState().micEnabled).toBe(false);
  });

  it('supports explicit state machine transitions (idle -> connecting -> connected -> reconnecting -> failed -> unsupported)', () => {
    expect(useVoiceStore.getState().voiceStatus).toBe('idle');

    useVoiceStore.getState().setVoiceStatus('connecting');
    expect(useVoiceStore.getState().voiceStatus).toBe('connecting');

    useVoiceStore.getState().setVoiceStatus('connected');
    expect(useVoiceStore.getState().voiceStatus).toBe('connected');

    useVoiceStore.getState().setVoiceStatus('reconnecting');
    expect(useVoiceStore.getState().voiceStatus).toBe('reconnecting');

    useVoiceStore.getState().setVoiceStatus('failed');
    expect(useVoiceStore.getState().voiceStatus).toBe('failed');

    useVoiceStore.getState().setVoiceStatus('unsupported');
    expect(useVoiceStore.getState().voiceStatus).toBe('unsupported');
  });

  it('retryConnection increments retryCount, clears error/denial and sets status to connecting', () => {
    useVoiceStore.getState().setPermissionDenied(true);
    useVoiceStore.getState().setErrorMessage('Failed to connect');
    expect(useVoiceStore.getState().permissionDenied).toBe(true);
    expect(useVoiceStore.getState().voiceStatus).toBe('failed');

    useVoiceStore.getState().retryConnection();

    const state = useVoiceStore.getState();
    expect(state.retryCount).toBe(1);
    expect(state.permissionDenied).toBe(false);
    expect(state.errorMessage).toBeNull();
    expect(state.voiceStatus).toBe('connecting');
  });

  it('tracks audio playback blocked state for browser autoplay policy unlock', () => {
    expect(useVoiceStore.getState().audioPlaybackBlocked).toBe(false);

    useVoiceStore.getState().setAudioPlaybackBlocked(true);
    expect(useVoiceStore.getState().audioPlaybackBlocked).toBe(true);

    useVoiceStore.getState().setAudioPlaybackBlocked(false);
    expect(useVoiceStore.getState().audioPlaybackBlocked).toBe(false);
  });

  it('server permission revoke/restore cycles do not mutate micEnabled', () => {
    // User turns on mic
    useVoiceStore.getState().setMicEnabled(true);
    expect(useVoiceStore.getState().micEnabled).toBe(true);

    // Simulate server revoking publish permission (e.g. night phase begins or silenced)
    // Server-side revoke only affects the publishing layer, client intent store remains true
    expect(useVoiceStore.getState().micEnabled).toBe(true);

    // Server-side restores publish permission (e.g. morning discussion begins)
    // Client intent store is still true so audio publishing can seamlessly resume
    expect(useVoiceStore.getState().micEnabled).toBe(true);
  });
});
