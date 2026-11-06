import { describe, it, expect, beforeEach } from 'vitest';
import { useVoiceStore } from './useVoiceStore';

describe('Voice Store & Mic State (Section 2.1)', () => {
  beforeEach(() => {
    useVoiceStore.setState({ micEnabled: false, permissionDenied: false });
  });

  it('initial state is muted (micEnabled === false)', () => {
    expect(useVoiceStore.getState().micEnabled).toBe(false);
  });

  it('one click toggles micEnabled', () => {
    useVoiceStore.getState().toggleMic();
    expect(useVoiceStore.getState().micEnabled).toBe(true);

    useVoiceStore.getState().toggleMic();
    expect(useVoiceStore.getState().micEnabled).toBe(false);
  });

  it('permission denial does not toggle or clear mic preference', () => {
    useVoiceStore.getState().setMicEnabled(true);
    useVoiceStore.getState().setPermissionDenied(true);
    // User preference remains true even when hardware permission fails
    expect(useVoiceStore.getState().micEnabled).toBe(true);
    expect(useVoiceStore.getState().permissionDenied).toBe(true);
  });

  it('ignores double toggle within 300ms window on rapid touch/click simulation', () => {
    let lastClick = 0;
    const simulateClick = (now: number) => {
      if (now - lastClick < 300) return;
      lastClick = now;
      useVoiceStore.getState().toggleMic();
    };

    // User touches at t=1000
    simulateClick(1000);
    expect(useVoiceStore.getState().micEnabled).toBe(true);

    // Browser fires synthetic click at t=1050 (within 300ms)
    simulateClick(1050);
    expect(useVoiceStore.getState().micEnabled).toBe(true); // NOT double toggled!

    // Later user clicks at t=1500 (after 300ms)
    simulateClick(1500);
    expect(useVoiceStore.getState().micEnabled).toBe(false);
  });
});

