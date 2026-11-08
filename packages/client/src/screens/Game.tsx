import React from 'react';
import type { ClientState, Role } from '@ontorale/shared';
import { Header } from '../components/Header';
import { PlayerGrid } from '../components/PlayerGrid';
import { ActionPanel } from '../components/ActionPanel';
import { ChatPanel } from '../components/ChatPanel';
import { EventLog } from '../components/EventLog';
import { RoleAvatar } from '../components/RoleAvatar';
import { RoleRevealOverlay } from '../components/RoleRevealOverlay';
import { NightResultOverlay } from '../components/NightResultOverlay';
import { t } from '../i18n';
import { Users, UserCheck } from 'lucide-react';

interface GameProps {
  state: ClientState;
}

export const Game: React.FC<GameProps> = ({ state }) => {
  const { me, players, round, phase, phaseEndsAt, serverNow, roomCode, log } = state;
  const playerMap = new Map<string, string>(players.map((p) => [p.id, p.nickname]));

  const isMafia = me.team === 'mafia';
  const mePublic = players.find((p) => p.id === me.id);
  const isAutomatedTest = typeof navigator !== 'undefined' && Boolean(navigator.webdriver);

  const [showRoleReveal, setShowRoleReveal] = React.useState<boolean>(() => {
    if (
      typeof window === 'undefined' ||
      (typeof navigator !== 'undefined' && navigator.webdriver)
    ) {
      return false;
    }
    return !sessionStorage.getItem(`seen_reveal_${roomCode}_${me.id}`) && Boolean(me.role);
  });

  const [dismissedNightRound, setDismissedNightRound] = React.useState<number | null>(null);

  // Auto-dismiss role reveal when phase advances past initial night
  React.useEffect(() => {
    if (phase !== 'night' && showRoleReveal) {
      setShowRoleReveal(false);
    }
  }, [phase, showRoleReveal]);

  const handleDismissRoleReveal = () => {
    sessionStorage.setItem(`seen_reveal_${roomCode}_${me.id}`, 'true');
    setShowRoleReveal(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 font-sans pb-8">
      {/* Game Start Role Reveal Animation */}
      {showRoleReveal && me.role && me.team && (
        <RoleRevealOverlay
          role={me.role as Role}
          team={me.team}
          onDismiss={handleDismissRoleReveal}
        />
      )}

      {/* Night Result Suspense Animation */}
      {phase === 'nightResult' && dismissedNightRound !== round && !isAutomatedTest && (
        <NightResultOverlay
          round={round}
          log={log}
          playersMap={playerMap}
          onDismiss={() => setDismissedNightRound(round)}
        />
      )}

      <Header
        phase={phase}
        round={round}
        phaseEndsAt={phaseEndsAt}
        serverNow={serverNow}
        roomCode={roomCode}
        alive={me.alive}
        isMafia={isMafia}
        silenced={mePublic?.silenced ?? false}
      />

      <main className="max-w-7xl mx-auto w-full p-4 flex-1 flex flex-col lg:flex-row gap-6">
        {/* Left Column: Board & Actions */}
        <div className="flex-1 space-y-6 min-w-0">
          {/* Role Banner & Mafia Teammates */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl flex flex-wrap items-center justify-between gap-4">
            <div
              onClick={() => setShowRoleReveal(true)}
              className="flex items-center gap-3.5 cursor-pointer group"
              title="ভূমিকা অ্যানিমেশন পুনরায় দেখতে ক্লিক করুন"
            >
              {me.role ? <RoleAvatar role={me.role as Role} size="lg" /> : null}

              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block group-hover:text-slate-300 transition">
                  আপনার গোপন ভূমিকা
                </span>
                <div className="flex items-center gap-2">
                  <span
                    data-testid="my-role"
                    className="text-xl sm:text-2xl font-black font-bengali text-white group-hover:text-rose-400 transition"
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

            {/* Mafia Teammates list for alive mafia (Section 9) */}
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
                        className="text-xs bg-red-950/80 border border-red-800/80 text-red-200 px-2.5 py-1 rounded-md flex items-center gap-1.5"
                      >
                        <RoleAvatar role={mate.role as Role} size="sm" />
                        <span>
                          {mateName} ({t(`role.${mate.role}`)})
                        </span>
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

          {/* Event Log */}
          <section>
            <EventLog log={log} playersMap={playerMap} />
          </section>
        </div>

        {/* Right Column: Chat Panel */}
        <div className="w-full lg:w-80 lg:shrink-0 flex flex-col">
          <ChatPanel state={state} />
        </div>
      </main>
    </div>
  );
};
