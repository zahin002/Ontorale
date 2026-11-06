import React, { useRef, useEffect } from 'react';
import type { GameEvent, Phase } from '@ontorale/shared';
import { t } from '../i18n';
import { Bell } from 'lucide-react';

interface EventLogProps {
  log: { round: number; phase: Phase; event: GameEvent }[];
  playersMap: Map<string, string>;
}

export const EventLog: React.FC<EventLogProps> = ({ log, playersMap }) => {
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [log]);

  const renderEventText = (e: GameEvent): string => {
    switch (e.kind) {
      case 'death': {
        const name = playersMap.get(e.id) || e.id;
        const cause = e.causes.includes('police') ? 'Police' : 'Mafia';
        const eventKey = cause === 'Police' ? 'event.deathPolice' : 'event.deathMafia';
        const roleReveal = t(`reveal.${e.role}`, { name, role: t(`role.${e.role}`) });
        return `${t(eventKey, { name })} ${roleReveal}`;
      }
      case 'saved': {
        const name = playersMap.get(e.id) || e.id;
        const key = e.from === 'police' ? 'event.savedPolice' : 'event.savedMafia';
        return t(key, { name });
      }
      case 'silenced': {
        const name = playersMap.get(e.id) || e.id;
        return t('event.silenced', { name });
      }
      case 'noDeaths':
        return t('event.noDeaths');
      case 'voteOut': {
        const name = playersMap.get(e.id) || e.id;
        const roleReveal = t(`reveal.${e.role}`, { name, role: t(`role.${e.role}`) });
        return `${t('event.voteOut', { name })} ${roleReveal}`;
      }
      case 'voteTie':
        return t('event.voteTie');
      case 'noElimination':
        return t('event.noElimination');
      case 'disconnected': {
        const name = playersMap.get(e.id) || e.id;
        const roleReveal = t(`reveal.${e.role}`, { name, role: t(`role.${e.role}`) });
        return `${t('event.disconnected', { name })} ${roleReveal}`;
      }
      case 'gameOver':
        return e.winner === 'citizens' ? t('win.citizens') : t('win.mafia');
      default:
        return '';
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col h-[220px] shadow-lg">
      <div className="text-xs font-semibold text-slate-400 mb-2 flex items-center gap-1.5 border-b border-slate-800 pb-1.5">
        <Bell className="w-3.5 h-3.5 text-rose-400" /> ঘটনা বিবরণী
      </div>

      <div
        data-testid="event-log"
        aria-live="polite"
        className="flex-1 overflow-y-auto space-y-1.5 text-xs text-slate-300 pr-1"
      >
        {log.length === 0 ? (
          <div className="text-slate-500 italic text-center mt-8">এখনো কোনো ঘটনা ঘটেনি</div>
        ) : (
          log.map((item, idx) => (
            <div
              key={idx}
              className="p-2 rounded bg-slate-800/60 border border-slate-800 text-slate-200 leading-relaxed font-bengali flex items-start gap-2"
            >
              <span className="text-[10px] font-mono text-slate-500 shrink-0 mt-0.5">
                R{item.round}
              </span>
              <span>{renderEventText(item.event)}</span>
            </div>
          ))
        )}
        <div ref={logEndRef} />
      </div>
    </div>
  );
};
