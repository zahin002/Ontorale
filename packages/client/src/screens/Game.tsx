import React from 'react';
import type { ClientState } from '@ontorale/shared';
import { Header } from '../components/Header';
import { PlayerGrid } from '../components/PlayerGrid';
import { ActionPanel } from '../components/ActionPanel';
import { ChatPanel } from '../components/ChatPanel';
import { EventLog } from '../components/EventLog';
import { t } from '../i18n';
import { Shield, Users, UserCheck } from 'lucide-react';

interface GameProps {
  state: ClientState;
}

export const Game: React.FC<GameProps> = ({ state }) => {
  const { me, players, round, phase, phaseEndsAt, serverNow, roomCode, log } = state;
  const playerMap = new Map<string, string>(players.map((p) => [p.id, p.nickname]));

  const isMafia = me.team === 'mafia';

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 font-sans pb-8">
      <Header
        phase={phase}
        round={round}
        phaseEndsAt={phaseEndsAt}
        serverNow={serverNow}
        roomCode={roomCode}
      />

      <main className="max-w-5xl mx-auto w-full p-4 space-y-6 flex-1">
        {/* Role Banner & Mafia Teammates */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div
              className={`p-3 rounded-xl border ${
                isMafia
                  ? 'bg-red-950/60 border-red-800 text-red-400'
                  : 'bg-emerald-950/60 border-emerald-800 text-emerald-400'
              }`}
            >
              <Shield className="w-6 h-6" />
            </div>

            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                আপনার গোপন ভূমিকা
              </span>
              <div className="flex items-center gap-2">
                <span
                  data-testid="my-role"
                  className="text-xl sm:text-2xl font-black font-bengali text-white"
                >
                  {me.role ? t(`role.${me.role}`) : 'অজানা'}
                </span>
                <span
                  className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${
                    isMafia
                      ? 'bg-red-500/10 border-red-500/30 text-red-400'
                      : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  }`}
                >
                  {me.team ? t(`team.${me.team}`) : ''}
                </span>
              </div>
            </div>
          </div>

          {/* Mafia Teammates list for alive mafia */}
          {me.mafiaTeam && me.mafiaTeam.length > 0 && (
            <div className="flex flex-col items-start sm:items-end">
              <span className="text-[10px] font-bold uppercase tracking-wider text-red-400 mb-1 flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5" /> মাফিয়া সতীর্থবৃন্দ
              </span>
              <div className="flex flex-wrap gap-1.5">
                {me.mafiaTeam.map((mate) => {
                  const mateName = playerMap.get(mate.id) || mate.id;
                  return (
                    <span
                      key={mate.id}
                      className="text-xs bg-red-950/80 border border-red-800/80 text-red-200 px-2 py-1 rounded-md"
                    >
                      {mateName} ({t(`role.${mate.role}`)})
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Player Grid */}
        <section className="space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Users className="w-4 h-4 text-slate-400" /> খেলোয়াড় তালিকা ({players.length})
          </h2>
          <PlayerGrid players={players} myId={me.id} />
        </section>

        {/* Contextual Action Panel */}
        <section>
          <ActionPanel state={state} />
        </section>

        {/* Split Grid: Event Log & Chat Panel */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <EventLog log={log} playersMap={playerMap} />
          <ChatPanel state={state} />
        </div>
      </main>
    </div>
  );
};
