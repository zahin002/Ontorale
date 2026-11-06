import { create } from 'zustand';
import { io, type Socket } from 'socket.io-client';
import type { ActionKind, ClientState, RoomSettings } from '@ontorale/shared';

export interface ChatMessage {
  id: string;
  channel: 'public' | 'mafia';
  from: string;
  nickname: string;
  text: string;
  ts: number;
}

interface GameStore {
  socket: Socket | null;
  connected: boolean;
  state: ClientState | null;
  chatMessages: ChatMessage[];
  sessionToken: string | null;
  roomCode: string | null;
  playerId: string | null;
  error: string | null;

  initSocket: () => Socket;
  createRoom: (
    nickname: string,
    settings?: RoomSettings,
  ) => Promise<{ ok: boolean; error?: string }>;
  joinRoom: (roomCode: string, nickname: string) => Promise<{ ok: boolean; error?: string }>;
  resumeRoom: () => Promise<boolean>;
  updateSettings: (settings: RoomSettings) => Promise<{ ok: boolean; error?: string }>;
  startGame: () => Promise<{ ok: boolean; error?: string }>;
  rematch: () => Promise<{ ok: boolean; error?: string }>;
  submitAction: (
    kind: ActionKind,
    targetId: string | null,
  ) => Promise<{ ok: boolean; error?: string }>;
  castVote: (targetId: string | null) => Promise<{ ok: boolean; error?: string }>;
  mayorDecide: (targetId: string | null) => Promise<{ ok: boolean; error?: string }>;
  sendChat: (channel: 'public' | 'mafia', text: string) => Promise<{ ok: boolean; error?: string }>;
  clearError: () => void;
}

interface SocketAck<T = Record<string, unknown>> {
  ok: boolean;
  data?: T;
  error?: string;
}

export const useGameStore = create<GameStore>((set, get) => ({
  socket: null,
  connected: false,
  state: null,
  chatMessages: [],
  sessionToken: sessionStorage.getItem('ontorale_session_token'),
  roomCode: sessionStorage.getItem('ontorale_room_code'),
  playerId: sessionStorage.getItem('ontorale_player_id'),
  error: null,

  clearError: () => set({ error: null }),

  initSocket: () => {
    let s = get().socket;
    if (s && s.connected) return s;

    s = io({
      transports: ['websocket', 'polling'],
      autoConnect: true,
    });

    s.on('connect', () => {
      set({ connected: true });
      get().resumeRoom();
    });

    s.on('disconnect', () => {
      set({ connected: false });
    });

    s.on('state', (state: ClientState) => {
      set({ state });
    });

    s.on('chat', (msg: ChatMessage) => {
      set((prev) => ({ chatMessages: [...prev.chatMessages, msg] }));
    });

    s.on('chat:history', (history: ChatMessage[]) => {
      set({ chatMessages: history });
    });

    set({ socket: s });
    return s;
  },

  createRoom: async (nickname, settings) => {
    const s = get().initSocket();
    return new Promise((resolve) => {
      s.emit(
        'room:create',
        { nickname, settings },
        (res: SocketAck<{ roomCode: string; playerId: string; sessionToken: string }>) => {
          if (res.ok && res.data) {
            sessionStorage.setItem('ontorale_session_token', res.data.sessionToken);
            sessionStorage.setItem('ontorale_room_code', res.data.roomCode);
            sessionStorage.setItem('ontorale_player_id', res.data.playerId);
            set({
              sessionToken: res.data.sessionToken,
              roomCode: res.data.roomCode,
              playerId: res.data.playerId,
              error: null,
            });
            resolve({ ok: true });
          } else {
            set({ error: res.error || 'Failed to create room' });
            resolve({ ok: false, error: res.error });
          }
        },
      );
    });
  },

  joinRoom: async (roomCode, nickname) => {
    const s = get().initSocket();
    return new Promise((resolve) => {
      s.emit(
        'room:join',
        { roomCode, nickname },
        (res: SocketAck<{ playerId: string; sessionToken: string }>) => {
          if (res.ok && res.data) {
            sessionStorage.setItem('ontorale_session_token', res.data.sessionToken);
            sessionStorage.setItem('ontorale_room_code', roomCode);
            sessionStorage.setItem('ontorale_player_id', res.data.playerId);
            set({
              sessionToken: res.data.sessionToken,
              roomCode,
              playerId: res.data.playerId,
              error: null,
            });
            resolve({ ok: true });
          } else {
            set({ error: res.error || 'Failed to join room' });
            resolve({ ok: false, error: res.error });
          }
        },
      );
    });
  },

  resumeRoom: async () => {
    const s = get().socket;
    const token = get().sessionToken;
    const code = get().roomCode;
    if (!s || !token || !code) return false;

    return new Promise((resolve) => {
      s.emit(
        'room:resume',
        { roomCode: code, sessionToken: token },
        (res: SocketAck<{ playerId: string }>) => {
          if (res.ok) {
            resolve(true);
          } else {
            sessionStorage.removeItem('ontorale_session_token');
            sessionStorage.removeItem('ontorale_room_code');
            sessionStorage.removeItem('ontorale_player_id');
            set({ sessionToken: null, roomCode: null, playerId: null });
            resolve(false);
          }
        },
      );
    });
  },

  updateSettings: async (settings) => {
    const s = get().socket;
    if (!s) return { ok: false, error: 'notConnected' };
    return new Promise((resolve) => {
      s.emit('room:settings', settings, (res: SocketAck) => {
        if (res.ok) resolve({ ok: true });
        else resolve({ ok: false, error: res.error });
      });
    });
  },

  startGame: async () => {
    const s = get().socket;
    if (!s) return { ok: false, error: 'notConnected' };
    return new Promise((resolve) => {
      s.emit('room:start', {}, (res: SocketAck) => {
        if (res.ok) resolve({ ok: true });
        else resolve({ ok: false, error: res.error });
      });
    });
  },

  rematch: async () => {
    const s = get().socket;
    if (!s) return { ok: false, error: 'notConnected' };
    return new Promise((resolve) => {
      s.emit('room:rematch', {}, (res: SocketAck) => {
        if (res.ok) resolve({ ok: true });
        else resolve({ ok: false, error: res.error });
      });
    });
  },

  submitAction: async (kind, targetId) => {
    const s = get().socket;
    if (!s) return { ok: false, error: 'notConnected' };
    return new Promise((resolve) => {
      s.emit('action:submit', { kind, targetId }, (res: SocketAck) => {
        if (res.ok) resolve({ ok: true });
        else resolve({ ok: false, error: res.error });
      });
    });
  },

  castVote: async (targetId) => {
    const s = get().socket;
    if (!s) return { ok: false, error: 'notConnected' };
    return new Promise((resolve) => {
      s.emit('vote:cast', { targetId }, (res: SocketAck) => {
        if (res.ok) resolve({ ok: true });
        else resolve({ ok: false, error: res.error });
      });
    });
  },

  mayorDecide: async (targetId) => {
    const s = get().socket;
    if (!s) return { ok: false, error: 'notConnected' };
    return new Promise((resolve) => {
      s.emit('mayor:decide', { targetId }, (res: SocketAck) => {
        if (res.ok) resolve({ ok: true });
        else resolve({ ok: false, error: res.error });
      });
    });
  },

  sendChat: async (channel, text) => {
    const s = get().socket;
    if (!s) return { ok: false, error: 'notConnected' };
    return new Promise((resolve) => {
      s.emit('chat:send', { channel, text }, (res: SocketAck) => {
        if (res.ok) resolve({ ok: true });
        else resolve({ ok: false, error: res.error });
      });
    });
  },
}));
