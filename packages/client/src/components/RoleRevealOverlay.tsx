import React, { useState, useEffect } from 'react';
import type { Role } from '@ontorale/shared';
import { RoleAvatar } from './RoleAvatar';
import { Sparkles, ArrowRight } from 'lucide-react';

interface RoleRevealOverlayProps {
  role: Role;
  team: 'citizens' | 'mafia';
  onDismiss: () => void;
}

export const RoleRevealOverlay: React.FC<RoleRevealOverlayProps> = ({ role, team, onDismiss }) => {
  const [stage, setStage] = useState<'anticipation' | 'revealed'>('anticipation');
  const isMafia = team === 'mafia';

  useEffect(() => {
    // Stage 1: Anticipation (dark screen, mystery text) for 1 second
    const timer1 = setTimeout(() => {
      setStage('revealed');
    }, 1100);

    // Auto dismiss after 5 seconds total
    const timer2 = setTimeout(() => {
      onDismiss();
    }, 5500);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [onDismiss]);

  const getRoleAnnouncement = (r: Role): string => {
    switch (r) {
      case 'killer':
        return 'আপনি খুনি!';
      case 'doctor':
        return 'আপনি ডাক্তার!';
      case 'police':
        return 'আপনি পুলিশ!';
      case 'detective':
        return 'আপনি গোয়েন্দা!';
      case 'habildar':
        return 'আপনি হাবিলদার!';
      case 'mayor':
        return 'আপনি মেয়র!';
      case 'silencer':
        return 'আপনি নিস্তব্ধকারী!';
      case 'confuser':
        return 'আপনি বিভ্রান্তকারী!';
      case 'stalker':
        return 'আপনি অনুসরণকারী!';
      case 'citizen':
      default:
        return 'আপনি সাধারণ নাগরিক!';
    }
  };

  const getRoleHint = (r: Role): string => {
    switch (r) {
      case 'killer':
        return 'প্রতি রাতে সতীর্থদের সাথে মিলে শহরবাসীকে নির্মূল করুন!';
      case 'doctor':
        return 'প্রতি রাতে একজনকে নিশ্চিত মৃত্যুর হাত থেকে রক্ষা করুন!';
      case 'police':
        return 'সন্দেহভাজন মাফিয়াকে রাতের আঁধারে গুলি করে শাস্তি দিন!';
      case 'detective':
        return 'রাতে যে কারো আসল পরিচয় গোপনে তদন্ত করে জেনে নিন!';
      case 'habildar':
        return 'সন্দেহভাজনদের বিশেষ ক্ষমতা সাময়িক সময়ের জন্য অকার্যকর করুন!';
      case 'mayor':
        return 'ভোটের ফলাফলে সমতা হলে আপনার সিদ্ধান্তই চূড়ান্ত হিসেবে গণ্য হবে!';
      case 'silencer':
        return 'প্রতি রাতে একজন নাগরিককে পরবর্তী দিনের জন্য নিস্তব্ধ করুন!';
      case 'confuser':
        return 'গোয়েন্দার তদন্তে মাফিয়ার পরিচয় গোপন করতে বিভ্রান্তি ছড়ান!';
      case 'stalker':
        return 'গেমে একবার যে কোনো নাগরিকের চরিত্র নিশ্চিতভাবে জেনে নিন!';
      case 'citizen':
      default:
        return 'দিনের আলোচনা ও ভোটের মাধ্যমে মাফিয়াদের খুঁজে বের করে শহর রক্ষা করুন!';
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-center select-none animate-in fade-in duration-500"
    >
      {stage === 'anticipation' ? (
        <div className="space-y-4 max-w-md animate-pulse">
          <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 mx-auto flex items-center justify-center shadow-2xl">
            <Sparkles className="w-8 h-8 text-rose-500 animate-spin" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold font-bengali text-slate-300 tracking-wide">
            গেম শুরু হয়েছে...
          </h2>
          <p className="text-sm text-slate-500">আপনার গোপন ভূমিকা নির্ধারণ করা হচ্ছে</p>
        </div>
      ) : (
        <div className="space-y-6 max-w-lg w-full transform transition-all duration-700 ease-out scale-100 opacity-100">
          <div className="relative inline-block">
            <div
              className={`absolute -inset-4 rounded-full blur-2xl opacity-60 animate-pulse ${
                isMafia ? 'bg-red-600' : 'bg-emerald-500'
              }`}
            />
            <div className="relative p-2 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl scale-125">
              <RoleAvatar role={role} size="lg" />
            </div>
          </div>

          <div className="space-y-2">
            <span
              className={`text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full border ${
                isMafia
                  ? 'bg-red-950/80 border-red-500/50 text-red-400'
                  : 'bg-emerald-950/80 border-emerald-500/50 text-emerald-400'
              }`}
            >
              {isMafia ? 'মাফিয়া দল' : 'নাগরিক দল'}
            </span>
            <h1
              className={`text-4xl sm:text-5xl font-black font-bengali tracking-wide drop-shadow-md ${
                isMafia ? 'text-red-500' : 'text-emerald-400'
              }`}
            >
              {getRoleAnnouncement(role)}
            </h1>
          </div>

          <p className="text-slate-300 text-sm sm:text-base font-medium max-w-md mx-auto leading-relaxed bg-slate-900/60 p-4 rounded-2xl border border-slate-800 shadow-inner">
            {getRoleHint(role)}
          </p>

          <div className="pt-2">
            <button
              type="button"
              onClick={onDismiss}
              className={`px-6 py-2.5 rounded-xl font-bold text-sm text-white shadow-xl transition inline-flex items-center gap-2 hover:scale-105 active:scale-95 ${
                isMafia
                  ? 'bg-red-600 hover:bg-red-500 border border-red-500'
                  : 'bg-emerald-600 hover:bg-emerald-500 border border-emerald-500'
              }`}
            >
              <span>খেলায় প্রবেশ করুন</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
