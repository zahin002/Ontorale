import React from 'react';
import type { ActionKind, ClientState, PublicPlayer } from '@ontorale/shared';
import { t } from '../i18n';
import { useGameStore } from '../store/useGameStore';
import { Target, Ban, CheckCircle2 } from 'lucide-react';

interface ActionPanelProps {
  state: ClientState;
}

export const ActionPanel: React.FC<ActionPanelProps> = ({ state }) => {
  const { submitAction, castVote, mayorDecide } = useGameStore();
  const { me, phase, players } = state;

  const playerMap = new Map<string, PublicPlayer>(players.map((p) => [p.id, p]));

  if (!me.alive) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center text-slate-400 text-sm">
        আপনি নিহত হয়েছেন। আপনি কেবল খেলা দেখতে ও শুনতে পারবেন।
      </div>
    );
  }

  // 1. NIGHT PHASE ACTION PANEL
  if (phase === 'night') {
    if (!me.role) return null;

    let actionKind: ActionKind | null = null;
    let title = '';
    let allowNone = false;

    switch (me.role) {
      case 'killer':
        actionKind = 'kill';
        title = 'কাকে হত্যা করতে চান নির্বাচন করুন:';
        allowNone = true;
        break;
      case 'doctor':
        actionKind = 'protect';
        title = 'কাকে রক্ষা করতে চান নির্বাচন করুন:';
        break;
      case 'police':
        actionKind = 'shoot';
        title = `কাকে গুলি করতে চান নির্বাচন করুন (${me.bullets ?? 0} গুলি বাকি):`;
        allowNone = true;
        break;
      case 'detective':
        actionKind = 'investigate';
        title = 'কাকে তদন্ত করতে চান নির্বাচন করুন:';
        break;
      case 'confuser':
        actionKind = 'confuse';
        title = 'কাকে বিভ্রান্ত করতে চান নির্বাচন করুন:';
        break;
      case 'silencer':
        actionKind = 'silence';
        title = 'কাকে নীরব করতে চান নির্বাচন করুন:';
        break;
      default:
        // Citizens and mayors have no night action
        return (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center text-slate-400 text-sm">
            রাতে আপনার কোনো গোপন দায়িত্ব নেই। রাত শেষ হওয়া পর্যন্ত অপেক্ষা করুন।
          </div>
        );
    }

    const currentTarget = me.pendingAction?.target;

    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-3 shadow-lg">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-sm text-slate-200 flex items-center gap-2">
            <Target className="w-4 h-4 text-rose-500" /> {title}
          </span>
          <span className="text-xs text-slate-400 italic font-bengali">
            {t('ui.changeUntilEnd')}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {allowNone && (
            <button
              data-testid="action-none"
              onClick={() => submitAction(actionKind, null)}
              className={`p-2.5 rounded-lg border text-sm font-medium transition flex items-center justify-center gap-1.5 ${
                currentTarget === null && me.pendingAction
                  ? 'bg-rose-500 text-white border-rose-400 shadow-md'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
              }`}
            >
              <Ban className="w-4 h-4" /> {t('ui.noOne')}
            </button>
          )}

          {me.allowedTargets.map((targetId) => {
            const targetPlayer = playerMap.get(targetId);
            const isSelected = currentTarget === targetId;

            return (
              <button
                key={targetId}
                data-testid={`target-${targetId}`}
                onClick={() => submitAction(actionKind, targetId)}
                className={`p-2.5 rounded-lg border text-sm font-medium truncate transition ${
                  isSelected
                    ? 'bg-rose-600 text-white border-rose-400 shadow-md font-bold'
                    : 'bg-slate-800/90 hover:bg-slate-700 text-slate-200 border-slate-700'
                }`}
                title={targetPlayer?.nickname}
              >
                {targetPlayer?.nickname}
              </button>
            );
          })}
        </div>

        {me.pendingAction && (
          <div className="text-xs text-rose-400 flex items-center gap-1.5 mt-1 font-medium">
            <CheckCircle2 className="w-4 h-4" /> আপনার বর্তমান পছন্দ:{' '}
            <span className="text-white font-bold">
              {currentTarget ? playerMap.get(currentTarget)?.nickname : t('ui.noOne')}
            </span>
          </div>
        )}
      </div>
    );
  }

  // 2. VOTING PHASE ACTION PANEL
  if (phase === 'voting') {
    const currentVote = me.myVote;

    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-3 shadow-lg">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-sm text-slate-200 flex items-center gap-2">
            <Target className="w-4 h-4 text-amber-500" /> যাকে ভোট দিতে চান নির্বাচন করুন:
          </span>
          <span className="text-xs text-slate-400 italic font-bengali">
            {t('ui.changeUntilEnd')}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          <button
            data-testid="vote-abstain"
            onClick={() => castVote(null)}
            className={`p-2.5 rounded-lg border text-sm font-medium transition flex items-center justify-center gap-1.5 ${
              currentVote === null && me.myVote !== undefined
                ? 'bg-amber-600 text-white border-amber-400 shadow-md font-bold'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
            }`}
          >
            <Ban className="w-4 h-4" /> {t('ui.abstain')}
          </button>

          {me.allowedTargets.map((targetId) => {
            const targetPlayer = playerMap.get(targetId);
            const isSelected = currentVote === targetId;

            return (
              <button
                key={targetId}
                data-testid={`target-${targetId}`}
                onClick={() => castVote(targetId)}
                className={`p-2.5 rounded-lg border text-sm font-medium truncate transition ${
                  isSelected
                    ? 'bg-amber-600 text-white border-amber-400 shadow-md font-bold'
                    : 'bg-slate-800/90 hover:bg-slate-700 text-slate-200 border-slate-700'
                }`}
                title={targetPlayer?.nickname}
              >
                {targetPlayer?.nickname}
              </button>
            );
          })}
        </div>

        {currentVote !== undefined && (
          <div className="text-xs text-amber-400 flex items-center gap-1.5 mt-1 font-medium">
            <CheckCircle2 className="w-4 h-4" /> আপনার ভোট দেওয়া হয়েছে:{' '}
            <span className="text-white font-bold">
              {currentVote ? playerMap.get(currentVote)?.nickname : t('ui.abstain')}
            </span>
          </div>
        )}
      </div>
    );
  }

  // 3. MAYOR TIEBREAK ACTION PANEL
  if (phase === 'mayorTiebreak') {
    if (me.role !== 'mayor' || !me.mayorOptions) {
      return (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center text-slate-400 text-sm">
          ভোটে সমতা হয়েছে। জীবিত মেয়র সিদ্ধান্ত নিচ্ছেন...
        </div>
      );
    }

    return (
      <div className="bg-slate-900 border border-amber-500/30 rounded-xl p-4 flex flex-col gap-3 shadow-lg">
        <span className="font-semibold text-sm text-amber-400 flex items-center gap-2">
          মেয়রের বিশেষ ক্ষমতা: সমতায় থাকা একজন খেলোয়াড়কে বাদ দিন অথবা কাউকে বাদ দেবেন না
        </span>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <button
            data-testid="action-none"
            onClick={() => mayorDecide(null)}
            className="p-2.5 rounded-lg border bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700 text-sm font-medium flex items-center justify-center gap-1.5"
          >
            <Ban className="w-4 h-4" /> {t('ui.eliminateNobody')}
          </button>

          {me.mayorOptions.map((targetId) => {
            const targetPlayer = playerMap.get(targetId);
            return (
              <button
                key={targetId}
                data-testid={`target-${targetId}`}
                onClick={() => mayorDecide(targetId)}
                className="p-2.5 rounded-lg border bg-rose-600 hover:bg-rose-500 text-white border-rose-500 text-sm font-bold truncate transition"
              >
                {targetPlayer?.nickname}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return null;
};
