import React, { useState } from 'react';
import { useGameStore } from '../store/useGameStore';
import { t } from '../i18n';
import { Plus, LogIn, AlertCircle } from 'lucide-react';

export const Home: React.FC = () => {
  const { createRoom, joinRoom, error, clearError, connected } = useGameStore();
  const [nickname, setNickname] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim() || loading) return;
    setLoading(true);
    await createRoom(nickname.trim());
    setLoading(false);
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim() || !roomCode.trim() || loading) return;
    setLoading(true);
    await joinRoom(roomCode.trim().toUpperCase(), nickname.trim());
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      <div className="max-w-md w-full bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-2xl backdrop-blur">
        <div className="text-center mb-8 flex flex-col items-center">
          <img
            src="/ontorale-logo.png"
            alt="অন্তরালে - Ontorale"
            className="w-48 sm:w-56 h-auto object-contain drop-shadow-[0_10px_25px_rgba(225,29,72,0.3)] hover:scale-105 transition-transform duration-300 mb-2"
          />
          <h1 className="sr-only">{t('game.title')}</h1>
          <p className="text-slate-400 text-xs sm:text-sm font-medium">
            বন্ধুদের সাথে সোশ্যাল ডিডাকশন গেম
          </p>
        </div>

        {!connected && (
          <div className="mb-4 p-2.5 rounded-xl bg-amber-950/40 border border-amber-800/60 text-amber-300 text-xs flex items-center justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span>সার্ভারের সাথে সংযোগ স্থাপন করা হচ্ছে... (ব্যাকএন্ড সার্ভার চালু রাখুন)</span>
          </div>
        )}

        {error && (
          <div className="mb-6 p-3 rounded-xl bg-red-950/60 border border-red-800/80 text-red-200 text-xs flex items-center justify-between">
            <span className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" /> {error}
            </span>
            <button onClick={clearError} className="text-slate-400 hover:text-white font-bold ml-2">
              ✕
            </button>
          </div>
        )}

        <div className="space-y-6">
          {/* Nickname input */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              {t('ui.nickname')}
            </label>
            <input
              data-testid="nickname-input"
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="আপনার নাম লিখুন..."
              maxLength={20}
              className="w-full bg-slate-950 border border-slate-700 text-slate-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-rose-500 transition"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 pt-2">
            {/* Create Room Button */}
            <button
              data-testid="create-room"
              onClick={handleCreate}
              disabled={!nickname.trim() || loading}
              className="w-full bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold py-3 px-4 rounded-xl shadow-lg transition flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>রুম তৈরি হচ্ছে...</span>
                </>
              ) : (
                <>
                  <Plus className="w-5 h-5" /> {t('ui.createRoom')}
                </>
              )}
            </button>

            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-slate-800"></div>
              <span className="flex-shrink mx-4 text-slate-600 text-xs uppercase">অথবা</span>
              <div className="flex-grow border-t border-slate-800"></div>
            </div>

            {/* Join Room Input & Button */}
            <form onSubmit={handleJoin} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  {t('ui.roomCode')}
                </label>
                <input
                  data-testid="room-code-input"
                  type="text"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  placeholder="৬ অক্ষরের রুম কোড"
                  maxLength={6}
                  className="w-full bg-slate-950 border border-slate-700 text-slate-100 uppercase tracking-widest text-center font-mono font-bold rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-rose-500 transition"
                />
              </div>

              <button
                data-testid="join-room"
                type="submit"
                disabled={!nickname.trim() || !roomCode.trim() || loading}
                className="w-full bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 font-bold py-3 px-4 rounded-xl border border-slate-700 transition flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-slate-200 border-t-transparent rounded-full animate-spin" />
                    <span>যোগ দেওয়া হচ্ছে...</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-5 h-5" /> {t('ui.joinRoom')}
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
