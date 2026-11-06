import React from 'react';
import { Countdown } from './Countdown';
import { t, setLocale, getLocale } from '../i18n';
import type { Phase } from '@ontorale/shared';

interface HeaderProps {
  phase: Phase;
  round: number;
  phaseEndsAt: number | null;
  serverNow: number;
  roomCode: string;
}

export const Header: React.FC<HeaderProps> = ({
  phase,
  round,
  phaseEndsAt,
  serverNow,
  roomCode,
}) => {
  const currentLang = getLocale();

  const toggleLanguage = () => {
    setLocale(currentLang === 'bn' ? 'en' : 'bn');
    window.location.reload();
  };

  return (
    <header className="bg-slate-900 border-b border-slate-800 p-4 sticky top-0 z-20 shadow-md">
      <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
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

          <button
            onClick={toggleLanguage}
            className="text-xs text-slate-400 hover:text-white border border-slate-700 px-2 py-1 rounded transition"
          >
            {currentLang === 'bn' ? 'English' : 'বাংলা'}
          </button>
        </div>
      </div>
    </header>
  );
};
