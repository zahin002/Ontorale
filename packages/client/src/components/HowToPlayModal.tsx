import React, { useState } from 'react';
import {
  X,
  BookOpen,
  Shield,
  Skull,
  Sun,
  Moon,
  Users,
  CheckCircle2,
  HelpCircle,
} from 'lucide-react';
import { RoleAvatar } from './RoleAvatar';
import type { Role } from '@ontorale/shared';

interface HowToPlayModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HowToPlayModal: React.FC<HowToPlayModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'rules' | 'citizens' | 'mafia'>('rules');

  if (!isOpen) return null;

  const citizenRoles: { role: Role; title: string; desc: string; tip: string }[] = [
    {
      role: 'doctor',
      title: 'ডাক্তার (Doctor)',
      desc: 'প্রতি রাতে যেকোনো একজন খেলোয়াড়কে মাফিয়া বা পুলিশের আক্রমণ থেকে বাঁচাতে পারেন (নিজেকেও বাঁচাতে পারেন)।',
      tip: 'গুরুত্বপূর্ণ খেলোয়াড়দের অনুমান করে বাঁচান।',
    },
    {
      role: 'detective',
      title: 'গোয়েন্দা (Detective)',
      desc: 'প্রতি রাতে গোপনে যেকোনো ১ জন খেলোয়াড়ের আসল ভূমিকা তদন্ত করে জেনে নিতে পারেন (গেমে সর্বোচ্চ ২ বার)।',
      tip: 'তদন্তের সঠিক তথ্য দিনের আলোচনায় চতুরতার সাথে প্রকাশ করুন।',
    },
    {
      role: 'police',
      title: 'পুলিশ (Police)',
      desc: 'প্রতি রাতে অপরাধী মনে হলে নিজের সিদ্ধান্তে যেকোনো খেলোয়াড়কে সরাসরি গুলি করে হত্যা করতে পারেন।',
      tip: 'সতর্ক থাকুন, ভুল করে নির্দোষ নাগরিক হত্যা করবেন না!',
    },
    {
      role: 'habildar',
      title: 'হাবিলদার (Habildar)',
      desc: 'যেকোনো জীবিত খেলোয়াড়কে টার্গেট করে পরবর্তী রাতের জন্য তার বিশেষ ক্ষমতা অকার্যকর করে দিতে পারেন।',
      tip: 'মাফিয়াদের বিশেষ কৌশল ভণ্ডুল করতে এটি দারুণ কার্যকর।',
    },
    {
      role: 'mayor',
      title: 'মেয়র (Mayor)',
      desc: 'দিনের ভোটে যদি সমতা (Tie) হয়, তবে মেয়রের ভোট বা সিদ্ধান্তেই চূড়ান্ত ব্যক্তি বাদ পড়বেন।',
      tip: 'দিনের বেলা বুদ্ধিদীপ্ত নেতৃত্ব দিন।',
    },
    {
      role: 'citizen',
      title: 'সাধারণ নাগরিক (Citizen)',
      desc: 'রাতে কোনো বিশেষ ক্ষমতা নেই। তবে দিনের আলোচনা ও যুক্তিপূর্ণ ভোটের মাধ্যমে মাফিয়া খুঁজে বের করাই আপনার শক্তি।',
      tip: 'কারো কথায় অসঙ্গতি লক্ষ্য করুন এবং সন্দেহভাজনকে চিহ্নিত করুন।',
    },
  ];

  const mafiaRoles: { role: Role; title: string; desc: string; tip: string }[] = [
    {
      role: 'killer',
      title: 'খুনি (Killer)',
      desc: 'মাফিয়া দলের প্রধান ঘাতক। প্রতি রাতে মাফিয়াদের সিক্রেট ভয়েস রুমে পরামর্শ করে একজনকে হত্যার নিশানা করেন।',
      tip: 'ডাক্তার বা গোয়েন্দাকে আগে নির্মূল করার চেষ্টা করুন।',
    },
    {
      role: 'silencer',
      title: 'নিস্তব্ধকারী (Silencer)',
      desc: 'প্রতি রাতে ১ জন নাগরিককে নিশানা করে পরদিনের জন্য তার ভয়েস ও চ্যাটে কথা বলার ক্ষমতা বন্ধ করে দিতে পারেন।',
      tip: 'যে নাগরিক ভালো যুক্তি দিচ্ছে বা গোয়েন্দা তথ্য দিচ্ছে, তাকে চুপ করিয়ে দিন।',
    },
    {
      role: 'confuser',
      title: 'বিভ্রান্তকারী (Confuser)',
      desc: 'গোয়েন্দা যাতে মাফিয়ার আসল পরিচয় সহজে শনাক্ত করতে না পারে, সেজন্য তদন্তে বিভ্রান্তি ছড়িয়ে নিরীহ দেখান।',
      tip: 'গোয়েন্দার তদন্ত লক্ষ্য করে দলের সতীর্থকে সুরক্ষিত রাখুন।',
    },
    {
      role: 'stalker',
      title: 'অনুসরণকারী (Stalker)',
      desc: 'গেমে একবার যেকোনো ১ জন সাধারণ নাগরিককে গোপনে যাচাই করে নিশ্চিত হতে পারেন।',
      tip: 'নাগরিকদের মধ্য থেকে ভুয়া পরিচয় ধরতে সাহায্য করে।',
    },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 select-none animate-in fade-in duration-300"
    >
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black font-bengali text-white tracking-wide">
                কীভাবে খেলবেন ও চরিত্র পরিচিতি
              </h2>
              <p className="text-xs text-slate-400">
                খেলার নিয়ম ও প্রতিটি চরিত্রের সহজ নির্দেশিকা
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
            title="বন্ধ করুন"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 p-2 gap-2 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('rules')}
            className={`flex-1 py-2 px-3 rounded-xl transition flex items-center justify-center gap-1.5 ${
              activeTab === 'rules'
                ? 'bg-slate-800 text-white shadow border border-slate-700'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <HelpCircle className="w-4 h-4 text-amber-400" />
            <span>খেলার নিয়ম</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('citizens')}
            className={`flex-1 py-2 px-3 rounded-xl transition flex items-center justify-center gap-1.5 ${
              activeTab === 'citizens'
                ? 'bg-emerald-950/60 border border-emerald-600/40 text-emerald-300'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Shield className="w-4 h-4 text-emerald-400" />
            <span>নাগরিক দল ({citizenRoles.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('mafia')}
            className={`flex-1 py-2 px-3 rounded-xl transition flex items-center justify-center gap-1.5 ${
              activeTab === 'mafia'
                ? 'bg-red-950/60 border border-red-600/40 text-red-300'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Skull className="w-4 h-4 text-red-400" />
            <span>মাফিয়া দল ({mafiaRoles.length})</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4 text-slate-300 text-sm flex-1 font-sans">
          {activeTab === 'rules' && (
            <div className="space-y-4">
              <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 space-y-2">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-rose-400" /> খেলার মূল উদ্দেশ্য
                </h3>
                <p className="text-slate-300 leading-relaxed text-xs sm:text-sm">
                  <strong>অন্তরালে</strong> একটি সামাজিক প্রতারণা ও বুদ্ধিমত্তার খেলা। শহরের
                  শান্তিপ্রিয় নাগরিকদের মাঝে গোপনে লুকিয়ে আছে কয়েকজন মাফিয়া। নাগরিক দলের লক্ষ্য হলো
                  মাফিয়াদের শনাক্ত করে শহর মুক্ত করা, আর মাফিয়াদের লক্ষ্য হলো পরিচয় গোপন রেখে
                  নাগরিকদের নিশ্চিহ্ন করা।
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-4 rounded-2xl bg-indigo-950/30 border border-indigo-800/40 space-y-2">
                  <div className="flex items-center gap-2 text-indigo-300 font-bold text-sm">
                    <Moon className="w-4 h-4" /> রাত পর্ব (Night Phase)
                  </div>
                  <ul className="text-xs text-slate-300 space-y-1.5 list-disc list-inside">
                    <li>শহর অন্ধকার হবে এবং সাধারণ নাগরিকরা ঘুমিয়ে থাকবে।</li>
                    <li>মাফিয়ারা সিক্রেট ভয়েস রুমে কথা বলে হত্যার শিকার নির্বাচন করবে।</li>
                    <li>ডাক্তার, পুলিশ, গোয়েন্দা ও হাবিলদার তাদের গোপন ক্ষমতা ব্যবহার করবেন।</li>
                  </ul>
                </div>

                <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-800/40 space-y-2">
                  <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
                    <Sun className="w-4 h-4" /> দিন ও ভোট পর্ব (Day & Voting)
                  </div>
                  <ul className="text-xs text-slate-300 space-y-1.5 list-disc list-inside">
                    <li>ভোরে রাতের ফলাফল উন্মোচিত হবে।</li>
                    <li>সবাই লাইভ ভয়েস ও চ্যাটে মুক্ত আলোচনা করে সন্দেহভাজন খুঁজবেন।</li>
                    <li>ভোটের মাধ্যমে সর্বোচ্চ ভোট পাওয়া সন্দেহভাজনকে শহর থেকে বিতাড়িত করা হবে।</li>
                  </ul>
                </div>
              </div>

              <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 space-y-2">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" /> জয়-পরাজয়ের শর্ত
                </h3>
                <ul className="text-xs text-slate-300 space-y-1.5">
                  <li className="flex items-start gap-2">
                    <span className="text-emerald-400 font-bold">✓ নাগরিক দলের জয়:</span> সব মাফিয়া
                    সদস্যকে ভোটের মাধ্যমে বা পুলিশের গুলিতে নির্মূল করতে পারলে।
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-400 font-bold">✓ মাফিয়া দলের জয়:</span> জীবিত মাফিয়া
                    সংখ্যা জীবিত নাগরিক সংখ্যার সমান হয়ে গেলে মাফিয়ারা শহর দখল করে জিতে যাবে।
                  </li>
                </ul>
              </div>
            </div>
          )}

          {activeTab === 'citizens' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-400">
                নাগরিক দলের সব সদস্য একে অপরকে চেনেন না। আলোচনা ও বুদ্ধিমত্তা দিয়ে মাফিয়া চিহ্নিত
                করতে হবে:
              </p>

              {citizenRoles.map((c) => (
                <div
                  key={c.role}
                  className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 hover:border-emerald-500/40 transition flex items-start gap-3.5"
                >
                  <div className="shrink-0 mt-0.5">
                    <RoleAvatar role={c.role} size="md" />
                  </div>
                  <div className="space-y-1 min-w-0">
                    <h4 className="font-bold text-emerald-300 text-sm font-bengali">{c.title}</h4>
                    <p className="text-xs text-slate-300 leading-relaxed">{c.desc}</p>
                    <p className="text-[11px] text-emerald-400/80 font-medium italic">
                      টিপ: {c.tip}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'mafia' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-400">
                মাফিয়া সদস্যরা রাতে একে অপরকে দেখতে পান এবং সিক্রেট ভয়েস চ্যানেলে আলোচনা করতে
                পারেন:
              </p>

              {mafiaRoles.map((m) => (
                <div
                  key={m.role}
                  className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 hover:border-red-500/40 transition flex items-start gap-3.5"
                >
                  <div className="shrink-0 mt-0.5">
                    <RoleAvatar role={m.role} size="md" />
                  </div>
                  <div className="space-y-1 min-w-0">
                    <h4 className="font-bold text-red-400 text-sm font-bengali">{m.title}</h4>
                    <p className="text-xs text-slate-300 leading-relaxed">{m.desc}</p>
                    <p className="text-[11px] text-red-400/80 font-medium italic">টিপ: {m.tip}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition"
          >
            বুঝেছি, বন্ধ করুন
          </button>
        </div>
      </div>
    </div>
  );
};
