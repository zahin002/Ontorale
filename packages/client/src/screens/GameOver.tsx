import React from 'react';
import type { ClientState } from '@ontorale/shared';
import { useGameStore } from '../store/useGameStore';
import { t } from '../i18n';
import { Trophy, RotateCcw, Users } from 'lucide-react';

interface GameOverProps {
  state: ClientState;
}

export const GameOver: React.FC<GameOverProps> = ({ state }) => {
  const { rematch } = useGameStore();
  const { winner, allRoles, players, me } = state;
  const isHost = me.isHost;

  const winnerText = winner === 'citizens' ? t('win.citizens') : t('win.mafia');
  const isCitizensWinner = winner === 'citizens';

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 font-sans">
      <div className="max-w-2xl w-full bg-slate-900/95 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur text-center space-y-8">
        <div>
          <div
            className={`inline-flex p-4 rounded-full mb-4 border ${
              isCitizensWinner
                ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-400'
                : 'bg-red-950/60 border-red-500/40 text-red-400'
            }`}
          >
            <Trophy className="w-12 h-12" />
          </div>

          <h1
            data-testid="winner"
            className={`text-3xl sm:text-4xl font-black font-bengali tracking-wide ${
              isCitizensWinner ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            {winnerText}
          </h1>
          <p className="text-slate-400 text-sm mt-2">গেমটি সমাপ্ত হয়েছে!</p>
        </div>

        {/* All Players and their True Roles */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 text-left">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-1.5">
            <Users className="w-4 h-4 text-slate-400" /> সবার আসল ভূমিকা উন্মোচন
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[280px] overflow-y-auto pr-1">
            {players.map((p) => {
              const role = allRoles ? allRoles[p.id] : p.revealedRole;
              const isMafia = role === 'killer' || role === 'silencer' || role === 'confuser';

              return (
                <div
                  key={p.id}
                  className="p-3 rounded-xl border border-slate-800 bg-slate-900/60 flex items-center justify-between text-xs"
                >
                  <span className="font-semibold text-slate-200 truncate max-w-[140px]">
                    {p.nickname}{' '}
                    {p.id === me.id && <span className="text-rose-400 font-normal">(You)</span>}
                  </span>
                  <span
                    className={`font-bold px-2 py-0.5 rounded border ${
                      isMafia
                        ? 'bg-red-950/80 border-red-800/80 text-red-300'
                        : 'bg-emerald-950/80 border-emerald-800/80 text-emerald-300'
                    }`}
                  >
                    {role ? t(`role.${role}`) : 'অজানা'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Rematch Button for Host */}
        <div className="pt-2">
          {isHost ? (
            <button
              data-testid="rematch"
              onClick={() => rematch()}
              className="w-full sm:w-auto px-8 bg-rose-600 hover:bg-rose-500 text-white font-bold py-3.5 rounded-xl shadow-lg transition inline-flex items-center justify-center gap-2 text-base"
            >
              <RotateCcw className="w-5 h-5" /> {t('ui.rematch')}
            </button>
          ) : (
            <p className="text-xs text-slate-400 italic">
              হোস্ট পুনরায় খেলার জন্য অপেক্ষা করা হচ্ছে...
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
