import React, { useState, useRef, useEffect } from 'react';
import type { ClientState } from '@ontorale/shared';
import { useGameStore } from '../store/useGameStore';
import { t } from '../i18n';
import { Send, MessageSquare, ShieldAlert } from 'lucide-react';

interface ChatPanelProps {
  state: ClientState;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({ state }) => {
  const { chatMessages, sendChat } = useGameStore();
  const [activeChannel, setActiveChannel] = useState<'public' | 'mafia'>('public');
  const [text, setText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { me, phase, players } = state;
  const isMafia = me.role === 'killer' || me.role === 'silencer' || me.role === 'confuser';
  const isAliveMafia = isMafia && me.alive;
  const mePublic = players.find((p) => p.id === me.id);
  const isSilenced = mePublic?.silenced ?? false;

  // Auto switch to mafia channel during night if alive mafia
  useEffect(() => {
    if (phase === 'night' && isAliveMafia) {
      setActiveChannel('mafia');
    } else {
      setActiveChannel('public');
    }
  }, [phase, isAliveMafia]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const canSendChat = (): { allowed: boolean; reason?: string } => {
    if (!me.alive) return { allowed: false, reason: 'মৃত খেলোয়াড় বার্তা পাঠাতে পারেন না' };
    if (activeChannel === 'public') {
      if (
        phase !== 'lobby' &&
        phase !== 'discussion' &&
        phase !== 'voting' &&
        phase !== 'gameOver'
      ) {
        return { allowed: false, reason: 'এই পর্বে পাবলিক চ্যাট বন্ধ' };
      }
      if ((phase === 'discussion' || phase === 'voting') && isSilenced) {
        return { allowed: false, reason: 'আপনি নীরব অবস্থায় আছেন, বার্তা পাঠাতে পারবেন না' };
      }
    } else if (activeChannel === 'mafia') {
      if (phase !== 'night' || !isAliveMafia) {
        return { allowed: false, reason: 'মাফিয়া চ্যাট কেবল রাতে মাফিয়াদের জন্য উপলব্ধ' };
      }
    }
    return { allowed: true };
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;

    const check = canSendChat();
    if (!check.allowed) return;

    await sendChat(activeChannel, trimmed);
    setText('');
  };

  const filteredMessages = chatMessages.filter((m) => m.channel === activeChannel);
  const sendStatus = canSendChat();

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl flex flex-col h-[320px] shadow-lg overflow-hidden">
      {/* Channel Tabs */}
      <div className="flex border-b border-slate-800 bg-slate-950/60 text-xs font-semibold">
        <button
          onClick={() => setActiveChannel('public')}
          className={`flex-1 py-2 px-3 flex items-center justify-center gap-1.5 border-b-2 transition ${
            activeChannel === 'public'
              ? 'border-rose-500 text-rose-400 bg-rose-500/5'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" /> {t('ui.publicChat')}
        </button>

        {isAliveMafia && (
          <button
            onClick={() => setActiveChannel('mafia')}
            className={`flex-1 py-2 px-3 flex items-center justify-center gap-1.5 border-b-2 transition ${
              activeChannel === 'mafia'
                ? 'border-red-600 text-red-400 bg-red-600/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" /> {t('ui.mafiaChat')}
          </button>
        )}
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 text-xs">
        {filteredMessages.length === 0 ? (
          <div className="text-center text-slate-500 mt-12 font-medium">কোনো বার্তা নেই</div>
        ) : (
          filteredMessages.map((msg) => {
            const isMyMsg = msg.from === me.id;
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMyMsg ? 'items-end' : 'items-start'}`}
              >
                <span className="text-[10px] text-slate-500 px-1 mb-0.5">
                  {msg.nickname} •{' '}
                  {new Date(msg.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                <div
                  className={`px-3 py-1.5 rounded-xl max-w-[85%] break-words whitespace-pre-wrap leading-relaxed ${
                    isMyMsg
                      ? activeChannel === 'mafia'
                        ? 'bg-red-800 text-white rounded-br-none'
                        : 'bg-rose-600 text-white rounded-br-none'
                      : activeChannel === 'mafia'
                        ? 'bg-slate-800 border border-red-900/60 text-red-200 rounded-bl-none'
                        : 'bg-slate-800 text-slate-200 rounded-bl-none'
                  }`}
                >
                  {/* Escaped plain text rendering */}
                  {msg.text}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <form
        onSubmit={handleSend}
        className="p-2 border-t border-slate-800 bg-slate-950/40 flex gap-2"
      >
        <input
          data-testid="chat-input"
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={!sendStatus.allowed}
          placeholder={sendStatus.allowed ? t('ui.chatPlaceholder') : sendStatus.reason}
          maxLength={300}
          className="flex-1 bg-slate-900 border border-slate-700 disabled:opacity-50 text-slate-100 placeholder:text-slate-500 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-rose-500 transition"
        />
        <button
          data-testid="chat-send"
          type="submit"
          disabled={!sendStatus.allowed || !text.trim()}
          className="bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white rounded-lg px-3 py-1.5 text-xs font-semibold transition flex items-center justify-center shrink-0"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
};
