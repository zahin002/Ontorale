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

export function formatErrorMessage(error?: string): string {
  switch (error) {
    case 'rateLimited':
      return 'খুব দ্রুত রুম তৈরি বা অনুরোধ করা হচ্ছে। অনুগ্রহ করে এক মিনিট অপেক্ষা করুন।';
    case 'roomNotFound':
    case 'notFound':
      return 'রুমটি পাওয়া যায়নি। রুম কোডটি সঠিকভাবে দিন।';
    case 'gameAlreadyStarted':
      return 'এই রুমে খেলা ইতোমধ্যে শুরু হয়ে গেছে। নতুন খেলোয়াড় যোগ দিতে পারবে না।';
    case 'roomFull':
      return 'রুমটি সম্পূর্ণ ভর্তি (সর্বোচ্চ ১২ জন)।';
    case 'nicknameTaken':
      return 'এই নামটি এই রুমে ইতোমধ্যে ব্যবহৃত হয়েছে। অন্য ডাকনাম দিন।';
    case 'maxRoomsReached':
      return 'সার্ভারে সর্বোচ্চ রুমের সীমা পূর্ণ হয়ে গেছে। কিছুক্ষণ পর চেষ্টা করুন।';
    case 'badRequest':
      return 'অনুরোধটি সঠিক নয়। অনুগ্রহ করে আবার চেষ্টা করুন।';
    case 'notAllowed':
      return 'এই কাজটি করার অনুমতি নেই।';
    case 'voiceUnavailable':
      return 'ভয়েস সার্ভিস সংযোগ করা সম্ভব হচ্ছে না।';
    case 'timeout':
    case 'disconnected':
      return 'সার্ভারের সাথে সংযোগ পাওয়া যায়নি। ব্যাকএন্ড সার্ভার চালু আছে কিনা নিশ্চিত করুন।';
    default:
      return error || 'একটি সমস্যা দেখা দিয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।';
  }
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
      let resolved = false;
      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          const msg = formatErrorMessage('timeout');
          set({ error: msg });
          resolve({ ok: false, error: msg });
        }
      }, 7000);

      s.emit(
        'room:create',
        { nickname, settings },
        (res: SocketAck<{ roomCode: string; playerId: string; sessionToken: string }>) => {
          if (resolved) return;
          clearTimeout(timer);
          resolved = true;
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
            const friendly = formatErrorMessage(res.error);
            set({ error: friendly });
            resolve({ ok: false, error: friendly });
          }
        },
      );
    });
  },

  joinRoom: async (roomCode, nickname) => {
    const s = get().initSocket();
    return new Promise((resolve) => {
      let resolved = false;
      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          const msg = formatErrorMessage('timeout');
          set({ error: msg });
          resolve({ ok: false, error: msg });
        }
      }, 7000);

      s.emit(
        'room:join',
        { roomCode, nickname },
        (res: SocketAck<{ playerId: string; sessionToken: string }>) => {
          if (resolved) return;
          clearTimeout(timer);
          resolved = true;
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
            const friendly = formatErrorMessage(res.error);
            set({ error: friendly });
            resolve({ ok: false, error: friendly });
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
