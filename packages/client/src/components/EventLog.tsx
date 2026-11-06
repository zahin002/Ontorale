import React, { useRef, useEffect } from 'react';
import type { GameEvent, Phase, Role } from '@ontorale/shared';
import { t } from '../i18n';
import {
  Bell,
  Skull,
  ShieldCheck,
  VolumeX,
  UserCheck,
  AlertTriangle,
  Moon,
  Sun,
} from 'lucide-react';
import { RoleAvatar } from './RoleAvatar';

interface EventLogProps {
  log: { round: number; phase: Phase; event: GameEvent }[];
  playersMap: Map<string, string>;
}

export const EventLog: React.FC<EventLogProps> = ({ log, playersMap }) => {
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [log]);

  // Group log items by round and phase
  interface GroupedEvents {
    round: number;
    phase: Phase;
    items: GameEvent[];
  }

  const grouped = log.reduce<GroupedEvents[]>((acc, entry) => {
    const last = acc[acc.length - 1];
    if (last && last.round === entry.round && last.phase === entry.phase) {
      last.items.push(entry.event);
    } else {
      acc.push({
        round: entry.round,
        phase: entry.phase,
        items: [entry.event],
      });
    }
    return acc;
  }, []);

  const renderEventContent = (e: GameEvent, idx: number) => {
    switch (e.kind) {
      case 'death': {
        const name = playersMap.get(e.id) || e.id;
        const cause = e.causes.includes('police') ? 'Police' : 'Mafia';
        const eventKey = cause === 'Police' ? 'event.deathPolice' : 'event.deathMafia';
        return (
          <div key={idx} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-rose-300 font-semibold">
              <Skull className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span>{t(eventKey, { name })}</span>
            </div>
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-[11px] text-slate-300 shrink-0">
              <RoleAvatar role={e.role as Role} size="sm" />
              <span>{t(`role.${e.role}`)}</span>
            </div>
          </div>
        );
      }
      case 'saved': {
        const name = playersMap.get(e.id) || e.id;
        const key = e.from === 'police' ? 'event.savedPolice' : 'event.savedMafia';
        return (
          <div key={idx} className="flex items-center gap-1.5 text-emerald-300 font-semibold">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>{t(key, { name })}</span>
          </div>
        );
      }
      case 'silenced': {
        const name = playersMap.get(e.id) || e.id;
        return (
          <div key={idx} className="flex items-center gap-1.5 text-violet-300 font-semibold">
            <VolumeX className="w-3.5 h-3.5 text-violet-400 shrink-0" />
            <span>{t('event.silenced', { name })}</span>
          </div>
        );
      }
      case 'noDeaths':
        return (
          <div key={idx} className="text-slate-400 italic">
            {t('event.noDeaths')}
          </div>
        );
      case 'voteOut': {
        const name = playersMap.get(e.id) || e.id;
        return (
          <div key={idx} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-amber-300 font-semibold">
              <UserCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>{t('event.voteOut', { name })}</span>
            </div>
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-[11px] text-slate-300 shrink-0">
              <RoleAvatar role={e.role as Role} size="sm" />
              <span>{t(`role.${e.role}`)}</span>
            </div>
          </div>
        );
      }
      case 'voteTie':
        return (
          <div key={idx} className="text-amber-400/90 italic">
            {t('event.voteTie')}
          </div>
        );
      case 'noElimination':
        return (
          <div key={idx} className="text-slate-400 italic">
            {t('event.noElimination')}
          </div>
        );
      case 'disconnected': {
        const name = playersMap.get(e.id) || e.id;
        return (
          <div key={idx} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-slate-400">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span>{t('event.disconnected', { name })}</span>
            </div>
            {e.role && (
              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-[11px] text-slate-400 shrink-0">
                <RoleAvatar role={e.role as Role} size="sm" />
                <span>{t(`role.${e.role}`)}</span>
              </div>
            )}
          </div>
        );
      }
      case 'gameOver':
        return (
          <div key={idx} className="text-amber-400 font-bold text-sm">
            {e.winner === 'citizens' ? t('win.citizens') : t('win.mafia')}
          </div>
        );
      default:
        return null;
    }
  };

  const getPhaseHeading = (phase: Phase, round: number) => {
    const isNight = phase === 'night' || phase === 'nightResult';
    return (
      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
        {isNight ? (
          <Moon className="w-3 h-3 text-indigo-400" />
        ) : (
          <Sun className="w-3 h-3 text-amber-400" />
        )}
        <span>
          {t(`phase.${phase}`)} • {t('ui.round')} {round}
        </span>
      </div>
    );
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col h-[260px] shadow-lg">
      <div className="text-xs font-semibold text-slate-400 mb-2 flex items-center gap-1.5 border-b border-slate-800 pb-1.5">
        <Bell className="w-3.5 h-3.5 text-rose-400" /> ঘটনা বিবরণী
      </div>

      <div
        data-testid="event-log"
        aria-live="polite"
        className="flex-1 overflow-y-auto space-y-2.5 text-xs text-slate-300 pr-1"
      >
        {log.length === 0 ? (
          <div className="text-slate-500 italic text-center mt-12">এখনো কোনো ঘটনা ঘটেনি</div>
        ) : (
          grouped.map((group, gIdx) => (
            <div key={gIdx} className="space-y-1">
              {getPhaseHeading(group.phase, group.round)}
              <div className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-800 text-slate-200 leading-relaxed font-bengali space-y-1.5">
                {group.items.map((e, idx) => renderEventContent(e, idx))}
              </div>
            </div>
          ))
        )}
        <div ref={logEndRef} />
      </div>
    </div>
  );
};
