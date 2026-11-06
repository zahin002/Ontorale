import { create } from 'zustand';

interface VoiceStore {
  micEnabled: boolean;
  permissionDenied: boolean;
  toggleMic: () => void;
  setMicEnabled: (enabled: boolean) => void;
  setPermissionDenied: (denied: boolean) => void;
}

export const useVoiceStore = create<VoiceStore>((set) => ({
  micEnabled: false,
  permissionDenied: false,
  toggleMic: () => set((s) => ({ micEnabled: !s.micEnabled })),
  setMicEnabled: (enabled: boolean) => set({ micEnabled: enabled }),
  setPermissionDenied: (denied: boolean) => set({ permissionDenied: denied }),
}));
