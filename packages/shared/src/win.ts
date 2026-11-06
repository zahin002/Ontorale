import type { Role, Team, WinMode } from './types';
import { isMafiaRole } from './roles';

export function checkWin(
  aliveMafia: number,
  aliveNonMafia: number,
  mode: WinMode = 'parity',
): Team | null {
  if (aliveMafia === 0) return 'citizens';
  switch (mode) {
    case 'plusOne':
      return aliveMafia >= aliveNonMafia + 1 ? 'mafia' : null;
    case 'examples':
      return aliveMafia + 1 >= aliveNonMafia ? 'mafia' : null;
    case 'parity':
      return aliveMafia >= aliveNonMafia ? 'mafia' : null;
  }
}

export interface PlayerForOutcome {
  status: 'alive' | 'dead' | 'disconnected';
  connected?: boolean;
  role?: Role | null;
  team?: Team | null;
}

export function evaluateOutcome(state: {
  players: Iterable<PlayerForOutcome> | Record<string, PlayerForOutcome>;
  winMode?: WinMode;
}): Team | null {
  let playerList: PlayerForOutcome[];
  if (Array.isArray(state.players)) {
    playerList = state.players;
  } else if (state.players instanceof Map) {
    playerList = Array.from(state.players.values());
  } else if (
    state.players &&
    typeof state.players === 'object' &&
    Symbol.iterator in state.players
  ) {
    playerList = Array.from(state.players as Iterable<PlayerForOutcome>);
  } else if (state.players && typeof state.players === 'object') {
    playerList = Object.values(state.players);
  } else {
    playerList = [];
  }

  const aliveConnected = playerList.filter((p) => p.status === 'alive' && p.connected !== false);

  const aliveMafia = aliveConnected.filter((p) => {
    if (p.team) return p.team === 'mafia';
    if (p.role) return isMafiaRole(p.role);
    return false;
  }).length;

  const aliveNonMafia = aliveConnected.length - aliveMafia;

  return checkWin(aliveMafia, aliveNonMafia, state.winMode ?? 'parity');
}
