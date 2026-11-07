import React from 'react';
import type { ClientState, RoomSettings } from '@ontorale/shared';
import { useGameStore } from '../store/useGameStore';
import { t } from '../i18n';
import { Users, Settings, Play, ShieldAlert, Copy, Check, ArrowLeft } from 'lucide-react';
import { ChatPanel } from '../components/ChatPanel';
import { VoiceControls } from '../components/VoiceControls';
import { VoiceErrorBoundary } from '../components/VoiceErrorBoundary';
import { useVoiceStore } from '../store/useVoiceStore';

interface LobbyProps {
  state: ClientState;
}

export const Lobby: React.FC<LobbyProps> = ({ state }) => {
  const { startGame, updateSettings, leaveRoom, connected } = useGameStore();
  const [copied, setCopied] = React.useState(false);

  const { players, me, roomCode, settings, validPlayerCounts } = state;
  const isHost = me.isHost;
  const playerCount = players.length;
  const isValidCount = validPlayerCounts.includes(playerCount);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggleRole = (roleKey: keyof RoomSettings['optional']) => {
    if (!isHost) return;
    updateSettings({
      ...settings,
      optional: {
        ...settings.optional,
        [roleKey]: !settings.optional[roleKey],
      },
    });
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      {!connected && (
        <div className="p-3 bg-amber-950/80 border border-amber-800 text-amber-200 text-xs rounded-xl flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 shrink-0" /> {t('ui.reconnectBanner')}
        </div>
      )}

      {/* Header Info */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
          <button
            onClick={() => leaveRoom()}
            className="px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-rose-950/60 hover:border-rose-500/50 hover:text-rose-300 text-slate-300 border border-slate-700 transition flex items-center gap-1.5 text-xs font-semibold shadow"
            title="রুম ত্যাগ করুন (Back to Home)"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>পেছনে যান</span>
          </button>

          <div>
            <span className="text-xs uppercase tracking-wider text-slate-400 font-bold block mb-1">
              {t('ui.roomCode')}
            </span>
            <div className="flex items-center gap-3">
              <span
                data-testid="room-code"
                className="text-3xl font-black font-mono tracking-widest text-rose-500 bg-slate-950 px-4 py-1.5 rounded-xl border border-slate-800"
              >
                {roomCode}
              </span>
              <button
                onClick={handleCopyCode}
                className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
                title="Copy Room Code"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-green-400" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-4">
          <div className="bg-slate-950/80 border border-slate-800 px-3 py-2 rounded-xl flex items-center gap-2 shadow-inner">
            <span className="text-xs text-slate-400 font-semibold hidden sm:inline">
              ভয়েস চ্যাট:
            </span>
            <VoiceErrorBoundary onRetry={() => useVoiceStore.getState().retryConnection()}>
              <VoiceControls
                roomCode={roomCode}
                phase="lobby"
                alive={true}
                isMafia={false}
                silenced={false}
              />
            </VoiceErrorBoundary>
          </div>

          <div className="text-right">
            <div className="text-sm font-semibold text-slate-300 flex items-center gap-1.5 justify-end">
              <Users className="w-4 h-4 text-rose-400" /> {playerCount} / 15 খেলোয়াড়
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Players List */}
        <div className="md:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 mb-4 flex items-center gap-2">
            <Users className="w-4 h-4 text-rose-400" /> {t('ui.players')}
          </h2>

          <div
            data-testid="player-list"
            className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[360px] overflow-y-auto"
          >
            {players.map((p) => (
              <div
                key={p.id}
                className={`p-3 rounded-xl border flex items-center justify-between text-sm transition ${
                  p.id === me.id
                    ? 'bg-rose-950/20 border-rose-500/40 text-rose-200'
                    : 'bg-slate-950/60 border-slate-800 text-slate-200'
                }`}
              >
                <span className="font-semibold truncate max-w-[150px]">{p.nickname}</span>
                {p.isHost && (
                  <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
                    HOST
                  </span>
                )}
              </div>
            ))}
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800">
            {isHost ? (
              <button
                data-testid="start-game"
                onClick={() => startGame()}
                disabled={!isValidCount}
                className="w-full bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:hover:bg-rose-600 text-white font-bold py-3.5 px-6 rounded-xl shadow-lg transition flex items-center justify-center gap-2 text-base"
              >
                <Play className="w-5 h-5 fill-current" /> {t('ui.startGame')}
              </button>
            ) : (
              <div className="text-center text-xs text-slate-400 py-2">
                হোস্ট গেম শুরু করার জন্য অপেক্ষা করা হচ্ছে...
              </div>
            )}
          </div>
        </div>

        {/* Host Settings */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 mb-4 flex items-center gap-2">
              <Settings className="w-4 h-4 text-slate-400" /> {t('ui.settings')}
            </h2>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1.5 font-medium">আলোচনার সময়:</label>
                <div className="grid grid-cols-2 gap-2">
                  {[180, 240].map((sec) => (
                    <button
                      key={sec}
                      disabled={!isHost}
                      onClick={() =>
                        updateSettings({ ...settings, discussionSec: sec as 180 | 240 })
                      }
                      className={`py-2 rounded-lg border font-semibold transition ${
                        settings.discussionSec === sec
                          ? 'bg-rose-600 border-rose-500 text-white shadow-sm'
                          : 'bg-slate-800 border-slate-700 text-slate-400 disabled:opacity-60'
                      }`}
                    >
                      {sec} সেকেন্ড
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1.5 font-medium">ভোটের সময়:</label>
                <div className="grid grid-cols-2 gap-2">
                  {[30, 60].map((sec) => (
                    <button
                      key={sec}
                      disabled={!isHost}
                      onClick={() => updateSettings({ ...settings, voteSec: sec as 30 | 60 })}
                      className={`py-2 rounded-lg border font-semibold transition ${
                        settings.voteSec === sec
                          ? 'bg-rose-600 border-rose-500 text-white shadow-sm'
                          : 'bg-slate-800 border-slate-700 text-slate-400 disabled:opacity-60'
                      }`}
                    >
                      {sec} সেকেন্ড
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1.5 font-medium">
                  ঐচ্ছিক চরিত্রসমূহ:
                </label>
                <div className="space-y-2">
                  {(
                    [
                      ['detective', 'role.detective'],
                      ['mayor', 'role.mayor'],
                      ['habildar', 'role.habildar'],
                      ['silencer', 'role.silencer'],
                      ['confuser', 'role.confuser'],
                      ['stalker', 'role.stalker'],
                    ] as const
                  ).map(([key, labelKey]) => (
                    <button
                      key={key}
                      data-testid={`toggle-role-${key}`}
                      disabled={!isHost}
                      onClick={() => handleToggleRole(key)}
                      className={`w-full py-2 px-3 rounded-lg border flex items-center justify-between font-semibold transition ${
                        settings.optional[key]
                          ? 'bg-slate-800 border-rose-500 text-rose-300'
                          : 'bg-slate-950/60 border-slate-800 text-slate-500'
                      }`}
                    >
                      <span>{t(labelKey)}</span>
                      <span className="text-[10px] uppercase font-mono">
                        {settings.optional[key] ? 'চালু' : 'বন্ধ'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Lobby Chat */}
      <ChatPanel state={state} />
    </div>
  );
};
