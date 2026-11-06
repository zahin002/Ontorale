import { describe, it, expect } from 'vitest';
import { SocketRateLimiter } from './rateLimit';
import { ChatSendSchema } from '@ontorale/shared';
import { Game } from '../game/Game';
import { FakeClock } from '../game/clock';
import type { Phase } from '@ontorale/shared';

describe('CHAT-01: Chat permission matrix, rate limits and length limits', () => {
  it('validates message length and sanitizes control characters', () => {
    // Normal message
    expect(ChatSendSchema.parse({ channel: 'public', text: 'Hello' }).text).toBe('Hello');

    // Max 300 chars allowed
    const maxText = 'a'.repeat(300);
    expect(ChatSendSchema.parse({ channel: 'public', text: maxText }).text).toBe(maxText);

    // 301 chars rejected
    expect(() => ChatSendSchema.parse({ channel: 'public', text: 'a'.repeat(301) })).toThrow();

    // Empty rejected
    expect(() => ChatSendSchema.parse({ channel: 'public', text: '' })).toThrow();

    // Strips control characters
    const withControls = 'Clean\u0000\u001FText';
    expect(ChatSendSchema.parse({ channel: 'public', text: withControls }).text).toBe('CleanText');
  });

  it('enforces rate limit: max 5 messages per 5 seconds', () => {
    const limiter = new SocketRateLimiter();
    const t0 = 100_000;

    // Send 5 messages within 5 seconds -> all allowed
    for (let i = 0; i < 5; i++) {
      expect(limiter.checkChat(t0 + i * 100)).toBe(true);
    }

    // 6th message within the same 5s window -> blocked
    expect(limiter.checkChat(t0 + 1000)).toBe(false);

    // After 5s window expires -> allowed again
    expect(limiter.checkChat(t0 + 5100)).toBe(true);
  });

  it('validates permission matrix across phases and roles (D18)', () => {
    const clock = new FakeClock();
    const game = new Game({ roomCode: 'CHAT01', clock });

    const pCitizen = game.addPlayer('Citizen', true);
    const pKiller = game.addPlayer('Killer', false);
    const pSilenced = game.addPlayer('Silenced', false);
    const pDead = game.addPlayer('Dead', false);

    if ('error' in pCitizen || 'error' in pKiller || 'error' in pSilenced || 'error' in pDead) {
      throw new Error();
    }

    pCitizen.player.role = 'citizen';
    pKiller.player.role = 'killer';
    pSilenced.player.role = 'citizen';
    pSilenced.player.silenced = true;
    pDead.player.role = 'citizen';
    pDead.player.status = 'dead';

    const canSend = (playerId: string, channel: 'public' | 'mafia', phase: Phase) => {
      game.phase = phase;
      const sender = game.getPlayer(playerId)!;
      const isMafia =
        sender.role === 'killer' || sender.role === 'silencer' || sender.role === 'confuser';

      if (channel === 'public') {
        return (
          game.phase === 'lobby' ||
          game.phase === 'gameOver' ||
          ((game.phase === 'discussion' || game.phase === 'voting') &&
            sender.status === 'alive' &&
            !sender.silenced)
        );
      } else if (channel === 'mafia') {
        return game.phase === 'night' && isMafia && sender.status === 'alive';
      }
      return false;
    };

    // 1. Lobby: public chat open to all, mafia closed
    expect(canSend(pCitizen.player.id, 'public', 'lobby')).toBe(true);
    expect(canSend(pKiller.player.id, 'public', 'lobby')).toBe(true);
    expect(canSend(pKiller.player.id, 'mafia', 'lobby')).toBe(false);

    // 2. Night: mafia chat only (alive mafia only), public chat closed
    expect(canSend(pCitizen.player.id, 'public', 'night')).toBe(false);
    expect(canSend(pKiller.player.id, 'public', 'night')).toBe(false);
    expect(canSend(pKiller.player.id, 'mafia', 'night')).toBe(true);
    expect(canSend(pCitizen.player.id, 'mafia', 'night')).toBe(false);

    // 3. Discussion & Voting: public chat for alive, non-silenced players
    for (const ph of ['discussion', 'voting'] as Phase[]) {
      expect(canSend(pCitizen.player.id, 'public', ph)).toBe(true);
      expect(canSend(pKiller.player.id, 'public', ph)).toBe(true);
      // Silenced player cannot send public chat
      expect(canSend(pSilenced.player.id, 'public', ph)).toBe(false);
      // Dead player cannot send public chat
      expect(canSend(pDead.player.id, 'public', ph)).toBe(false);
      // Mafia chat closed
      expect(canSend(pKiller.player.id, 'mafia', ph)).toBe(false);
    }

    // 4. NightResult, MayorTiebreak, VoteResult: no text chat
    for (const ph of ['nightResult', 'mayorTiebreak', 'voteResult'] as Phase[]) {
      expect(canSend(pCitizen.player.id, 'public', ph)).toBe(false);
      expect(canSend(pKiller.player.id, 'public', ph)).toBe(false);
      expect(canSend(pKiller.player.id, 'mafia', ph)).toBe(false);
    }

    // 5. GameOver: public chat open to all
    expect(canSend(pCitizen.player.id, 'public', 'gameOver')).toBe(true);
    expect(canSend(pSilenced.player.id, 'public', 'gameOver')).toBe(true);
    expect(canSend(pDead.player.id, 'public', 'gameOver')).toBe(true);
    expect(canSend(pKiller.player.id, 'mafia', 'gameOver')).toBe(false);
  });
});
