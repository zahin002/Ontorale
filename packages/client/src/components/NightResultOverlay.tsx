import React, { useState, useEffect } from 'react';
import type { GameEvent, Phase, Role } from '@ontorale/shared';
import { Moon, Sun, Skull, ShieldCheck, VolumeX, ArrowRight } from 'lucide-react';
import { RoleAvatar } from './RoleAvatar';
import { t } from '../i18n';

interface NightResultOverlayProps {
  round: number;
  log: { round: number; phase: Phase; event: GameEvent }[];
  playersMap: Map<string, string>;
  onDismiss?: () => void;
}

export const NightResultOverlay: React.FC<NightResultOverlayProps> = ({
  round,
  log,
  playersMap,
  onDismiss,
}) => {
  const [visibleCount, setVisibleCount] = useState<number>(0);

  // Bengali numerals helper
  const toBnNum = (n: number) => n.toString().replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[+d]);

  // Extract all night events for current round
  const nightEvents = log
    .filter((e) => e.round === round && (e.phase === 'night' || e.phase === 'nightResult'))
    .map((e) => e.event);

  const totalItems = nightEvents.length > 0 ? nightEvents.length : 1; // At least 1 (e.g. no deaths)

  useEffect(() => {
    // Reveal events one by one with a dramatic suspense delay
    const intervals: NodeJS.Timeout[] = [];

    for (let i = 1; i <= totalItems; i++) {
      const timer = setTimeout(
        () => {
          setVisibleCount(i);
        },
        1000 + (i - 1) * 1400,
      ); // 1.0s, 2.4s, 3.8s...
      intervals.push(timer);
    }

    return () => {
      intervals.forEach(clearTimeout);
    };
  }, [totalItems]);

  const renderEvent = (e: GameEvent, idx: number) => {
    switch (e.kind) {
      case 'death': {
        const name = playersMap.get(e.id) || e.id;
        const cause = e.causes.includes('police') ? 'Police' : 'Mafia';
        const eventKey = cause === 'Police' ? 'event.deathPolice' : 'event.deathMafia';
        return (
          <div
            key={idx}
            className="p-4 rounded-2xl bg-red-950/70 border border-red-500/50 shadow-2xl flex items-center justify-between gap-4 text-left animate-in slide-in-from-bottom-4 fade-in duration-700"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-red-900/60 border border-red-700 text-red-200">
                <Skull className="w-6 h-6 text-red-400 animate-pulse" />
              </div>
              <div>
                <span className="text-base sm:text-lg font-black text-red-200 font-bengali block">
                  {t(eventKey, { name })}
                </span>
                <span className="text-xs text-red-400">শহরের এক নাগরিক প্রাণ হারিয়েছেন</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-700 text-xs font-semibold text-slate-200 shrink-0">
              <RoleAvatar role={e.role as Role} size="sm" />
              <span>{t(`role.${e.role}`)}</span>
            </div>
          </div>
        );
      }
      case 'saved': {
        const name = playersMap.get(e.id) || e.id;
        return (
          <div
            key={idx}
            className="p-4 rounded-2xl bg-emerald-950/70 border border-emerald-500/50 shadow-2xl flex items-center gap-3 text-left animate-in slide-in-from-bottom-4 fade-in duration-700"
          >
            <div className="p-2.5 rounded-xl bg-emerald-900/60 border border-emerald-700 text-emerald-200">
              <ShieldCheck className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <span className="text-base sm:text-lg font-black text-emerald-200 font-bengali block">
                {t('event.savedMafia', { name })}
              </span>
              <span className="text-xs text-emerald-400">
                ডাক্তারের চিকিৎসায় জীবন রক্ষা পেয়েছে
              </span>
            </div>
          </div>
        );
      }
      case 'silenced': {
        const name = playersMap.get(e.id) || e.id;
        return (
          <div
            key={idx}
            className="p-4 rounded-2xl bg-amber-950/70 border border-amber-500/50 shadow-2xl flex items-center gap-3 text-left animate-in slide-in-from-bottom-4 fade-in duration-700"
          >
            <div className="p-2.5 rounded-xl bg-amber-900/60 border border-amber-700 text-amber-200">
              <VolumeX className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <span className="text-base sm:text-lg font-black text-amber-200 font-bengali block">
                {t('event.silenced', { name })}
              </span>
              <span className="text-xs text-amber-400">
                আজকের দিনের আলোচনায় কথা বলতে পারবেন না
              </span>
            </div>
          </div>
        );
      }
      default:
        return null;
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-center select-none animate-in fade-in duration-500"
    >
      <div className="max-w-xl w-full space-y-6">
        {/* Header: Big Round Typography */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-slate-300 text-xs font-semibold mb-2">
            <Moon className="w-4 h-4 text-indigo-400" />
            <span>ভোরের আগমন</span>
            <Sun className="w-4 h-4 text-amber-400 ml-1" />
          </div>

          <h1 className="text-4xl sm:text-6xl font-black font-bengali text-white tracking-wide drop-shadow-lg">
            রাত {toBnNum(round)}
          </h1>
          <p className="text-sm sm:text-base text-slate-400 font-medium">
            রাতের আঁধার কেটে ভোর হলো... রাতের ঘটনাবলী:
          </p>
        </div>

        {/* Suspense Events Container */}
        <div className="space-y-3 min-h-[160px] flex flex-col justify-center">
          {nightEvents.length === 0 ? (
            visibleCount >= 1 ? (
              <div className="p-5 rounded-2xl bg-emerald-950/50 border border-emerald-600/40 text-emerald-200 text-center animate-in zoom-in-95 duration-700 shadow-2xl">
                <span className="text-lg sm:text-xl font-bold font-bengali block mb-1">
                  আজ রাতে কেউ নিহত হয়নি!
                </span>
                <span className="text-xs text-emerald-400">
                  শহরবাসী নিরাপদে এবং অক্ষত অবস্থায় রাত কাটিয়েছে।
                </span>
              </div>
            ) : (
              <div className="text-slate-500 text-sm animate-pulse">ফলাফল উন্মোচিত হচ্ছে...</div>
            )
          ) : (
            nightEvents.slice(0, visibleCount).map((event, idx) => renderEvent(event, idx))
          )}

          {visibleCount < totalItems && nightEvents.length > 0 && (
            <div className="text-slate-500 text-xs animate-pulse pt-2">
              আরও ঘটনা প্রকাশ পাচ্ছে...
            </div>
          )}
        </div>

        {/* Skip / Continue Button */}
        {onDismiss && (
          <div className="pt-4">
            <button
              type="button"
              onClick={onDismiss}
              className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition inline-flex items-center gap-1.5 shadow"
            >
              <span>স্কিপ করুন</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
