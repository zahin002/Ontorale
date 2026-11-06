import React from 'react';
import type { PublicPlayer } from '@ontorale/shared';
import { t } from '../i18n';
import { VolumeX, Skull, WifiOff } from 'lucide-react';
import { RoleAvatar } from './RoleAvatar';

interface PlayerGridProps {
  players: PublicPlayer[];
  myId: string;
}

export const PlayerGrid: React.FC<PlayerGridProps> = ({ players, myId }) => {
  return (
    <div
      data-testid="player-list"
      className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3"
    >
      {players.map((p) => {
        const isMe = p.id === myId;
        const isDead = p.status === 'dead';
        const isDisconnected = p.status === 'disconnected';

        return (
          <div
            key={p.id}
            className={`p-3 rounded-xl border flex flex-col justify-between transition relative overflow-hidden ${
              isDead
                ? 'bg-slate-900/40 border-slate-800 text-slate-500 opacity-70'
                : isDisconnected
                  ? 'bg-slate-900/30 border-red-950 text-red-400 opacity-60'
                  : isMe
                    ? 'bg-rose-950/20 border-rose-500/40 text-slate-100 shadow-sm'
                    : 'bg-slate-900/90 border-slate-800 text-slate-200'
            }`}
          >
            <div className="flex items-start justify-between gap-1 mb-2">
              <span
                className="font-semibold text-sm truncate break-words max-w-[130px]"
                title={p.nickname}
              >
                {p.nickname}{' '}
                {isMe && <span className="text-xs text-rose-400 font-normal">(You)</span>}
              </span>
              <div className="flex items-center gap-1 shrink-0">
                {p.silenced && (
                  <span title={t('event.silenced', { name: p.nickname })}>
                    <VolumeX className="w-3.5 h-3.5 text-amber-400" />
                  </span>
                )}
                {isDead && <Skull className="w-3.5 h-3.5 text-slate-500" />}
                {isDisconnected && <WifiOff className="w-3.5 h-3.5 text-red-400" />}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-1 text-xs mt-1">
              {p.revealedRole ? (
                <span className="px-2 py-0.5 rounded font-medium bg-slate-800 text-slate-300 border border-slate-700 flex items-center gap-1">
                  <RoleAvatar role={p.revealedRole} size="sm" />
                  {t(`role.${p.revealedRole}`)}
                </span>
              ) : (
                <span className="text-[11px] text-slate-400">
                  {p.status === 'alive' ? 'জীবিত' : 'মৃত'}
                </span>
              )}

              {p.isHost && (
                <span className="text-[10px] font-bold tracking-wider uppercase text-amber-400">
                  HOST
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
