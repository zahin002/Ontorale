import type { Team, WinMode } from './types';

export function checkWin(aliveMafia: number, aliveNonMafia: number, mode: WinMode): Team | null {
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

