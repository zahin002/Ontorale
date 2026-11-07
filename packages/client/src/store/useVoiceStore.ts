import { create } from 'zustand';

export type VoiceStatus =
  'idle' | 'connecting' | 'connected' | 'reconnecting' | 'failed' | 'unsupported';

interface VoiceStore {
  voiceStatus: VoiceStatus;
  micEnabled: boolean;
  permissionDenied: boolean;
  audioPlaybackBlocked: boolean;
  errorMessage: string | null;
  retryCount: number;

  setVoiceStatus: (status: VoiceStatus) => void;
  toggleMic: () => void;
  setMicEnabled: (enabled: boolean) => void;
  setPermissionDenied: (denied: boolean) => void;
  setAudioPlaybackBlocked: (blocked: boolean) => void;
  setErrorMessage: (msg: string | null) => void;
  retryConnection: () => void;
  resetVoice: () => void;
}

export const useVoiceStore = create<VoiceStore>((set) => ({
  voiceStatus: 'idle',
  micEnabled: false,
  permissionDenied: false,
  audioPlaybackBlocked: false,
  errorMessage: null,
  retryCount: 0,

  setVoiceStatus: (voiceStatus) => set({ voiceStatus }),
  toggleMic: () => set((s) => ({ micEnabled: !s.micEnabled })),
  setMicEnabled: (micEnabled) => set({ micEnabled }),
  setPermissionDenied: (permissionDenied) =>
    set({
      permissionDenied,
      voiceStatus: permissionDenied ? 'failed' : 'idle',
    }),
  setAudioPlaybackBlocked: (audioPlaybackBlocked) => set({ audioPlaybackBlocked }),
  setErrorMessage: (errorMessage) => set({ errorMessage }),
  retryConnection: () =>
    set((s) => ({
      retryCount: s.retryCount + 1,
      voiceStatus: 'connecting',
      permissionDenied: false,
      errorMessage: null,
    })),
  resetVoice: () =>
    set({
      voiceStatus: 'idle',
      micEnabled: false,
      permissionDenied: false,
      audioPlaybackBlocked: false,
      errorMessage: null,
    }),
}));
