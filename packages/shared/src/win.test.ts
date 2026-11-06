import { describe, it, expect } from 'vitest';
import { checkWin } from './win';
import type { WinMode } from './types';

describe('checkWin - WIN-01 suite', () => {
  const modes: WinMode[] = ['plusOne', 'examples', 'parity'];

  it('M = 0 always results in citizens win across all modes', () => {
    for (const mode of modes) {
      expect(checkWin(0, 5, mode)).toBe('citizens');
      expect(checkWin(0, 1, mode)).toBe('citizens');
      expect(checkWin(0, 0, mode)).toBe('citizens');
    }
  });

  describe('examples mode', () => {
    it('matches rulebook worked examples: 1v2, 2v3, 3v4 win; 3v5 continues', () => {
      // 1v2 => 1 mafia, 2 non-mafia => win (1 + 1 >= 2)
      expect(checkWin(1, 2, 'examples')).toBe('mafia');
      // 2v3 => 2 mafia, 3 non-mafia => win (2 + 1 >= 3)
      expect(checkWin(2, 3, 'examples')).toBe('mafia');
      // 3v4 => 3 mafia, 4 non-mafia => win (3 + 1 >= 4)
      expect(checkWin(3, 4, 'examples')).toBe('mafia');
      // 3v5 => 3 mafia, 5 non-mafia => continues (3 + 1 = 4 < 5)
      expect(checkWin(3, 5, 'examples')).toBeNull();
    });

    it('handles parity and superior numbers in examples mode', () => {
      expect(checkWin(3, 3, 'examples')).toBe('mafia');
      expect(checkWin(4, 2, 'examples')).toBe('mafia');
    });
  });

  describe('plusOne mode (default)', () => {
    it('mafia wins if M >= N + 1', () => {
      // M = 2, N = 1 => 2 >= 2 => win
      expect(checkWin(2, 1, 'plusOne')).toBe('mafia');
      // M = 2, N = 2 => 2 < 3 => continues
      expect(checkWin(2, 2, 'plusOne')).toBeNull();
      // M = 1, N = 2 => continues
      expect(checkWin(1, 2, 'plusOne')).toBeNull();
      // M = 3, N = 2 => 3 >= 3 => win
      expect(checkWin(3, 2, 'plusOne')).toBe('mafia');
    });
  });

  describe('parity mode', () => {
    it('mafia wins if M >= N', () => {
      // M = 2, N = 2 => 2 >= 2 => win
      expect(checkWin(2, 2, 'parity')).toBe('mafia');
      // M = 1, N = 2 => 1 < 2 => continues
      expect(checkWin(1, 2, 'parity')).toBeNull();
      // M = 3, N = 2 => 3 >= 2 => win
      expect(checkWin(3, 2, 'parity')).toBe('mafia');
    });
  });
});
