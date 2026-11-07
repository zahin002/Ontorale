import React from 'react';
import { Countdown } from './Countdown';
import { VoiceControls } from './VoiceControls';
import { VoiceErrorBoundary } from './VoiceErrorBoundary';
import { useVoiceStore } from '../store/useVoiceStore';
import { useGameStore } from '../store/useGameStore';
import { t, setLocale, getLocale } from '../i18n';
import { LogOut } from 'lucide-react';
import type { Phase } from '@ontorale/shared';

interface HeaderProps {
  phase: Phase;
  round: number;
  phaseEndsAt: number | null;
  serverNow: number;
  roomCode: string;
  alive?: boolean;
  isMafia?: boolean;
  silenced?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  phase,
  round,
  phaseEndsAt,
  serverNow,
  roomCode,
  alive = true,
  isMafia = false,
  silenced = false,
}) => {
  const currentLang = getLocale();
  const { leaveRoom } = useGameStore();

  const toggleLanguage = () => {
    setLocale(currentLang === 'bn' ? 'en' : 'bn');
    window.location.reload();
  };

  const handleLeave = () => {
    if (window.confirm('আপনি কি নিশ্চিত যে আপনি রুম ত্যাগ করতে চান?')) {
      leaveRoom();
    }
  };

  return (
    <header className="bg-slate-900 border-b border-slate-800 p-4 sticky top-0 z-20 shadow-md">
      <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <img
            src="/ontorale-logo.png"
            alt="Ontorale Logo"
            className="w-8 h-8 sm:w-9 sm:h-9 object-contain drop-shadow"
          />
          <h1 className="text-xl font-black text-rose-500 tracking-wide font-bengali">
            {t('game.title')}
          </h1>
          <span
            data-testid="room-code"
            className="text-xs bg-slate-800 text-slate-300 font-mono px-2 py-1 rounded"
          >
            {roomCode}
          </span>
        </div>

        <div className="flex items-center gap-4">
          {round > 0 && phase !== 'lobby' && phase !== 'gameOver' && (
            <div className="text-sm text-slate-400 font-medium">
              {t('ui.round')} <span className="text-white font-bold">{round}</span>
            </div>
          )}

          <div
            data-testid="phase-name"
            className="text-sm font-semibold uppercase tracking-wider px-3 py-1 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20"
          >
            {t(`phase.${phase}`)}
          </div>

          <Countdown phaseEndsAt={phaseEndsAt} serverNow={serverNow} />

          <VoiceErrorBoundary onRetry={() => useVoiceStore.getState().retryConnection()}>
            <VoiceControls
              roomCode={roomCode}
              phase={phase}
              alive={alive}
              isMafia={isMafia}
              silenced={silenced}
            />
          </VoiceErrorBoundary>

          <button
            onClick={toggleLanguage}
            className="text-xs text-slate-400 hover:text-white border border-slate-700 px-2 py-1 rounded transition"
          >
            {currentLang === 'bn' ? 'English' : 'বাংলা'}
          </button>

          <button
            onClick={handleLeave}
            className="text-xs text-slate-400 hover:text-rose-400 border border-slate-700 hover:border-rose-500/50 px-2 py-1 rounded transition flex items-center gap-1"
            title="রুম ত্যাগ করুন"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">ত্যাগ করুন</span>
          </button>
        </div>
      </div>
    </header>
  );
};
