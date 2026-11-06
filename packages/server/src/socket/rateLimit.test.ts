import { describe, it, expect } from 'vitest';
import { SlidingWindowRateLimiter, SocketRateLimiter } from './rateLimit';

describe('rateLimit module', () => {
  it('handles sliding window limit, reset and cleanup', () => {
    const limiter = new SlidingWindowRateLimiter(2, 1000);
    const now = 5000;

    expect(limiter.check('key1', now)).toBe(true);
    expect(limiter.check('key1', now + 100)).toBe(true);
    // Exceeded
    expect(limiter.check('key1', now + 200)).toBe(false);

    // Reset clears state
    limiter.reset('key1');
    expect(limiter.check('key1', now + 300)).toBe(true);

    // Cleanup clears expired keys
    limiter.cleanup(now + 10_000);
    expect(limiter.check('key1', now + 10_000)).toBe(true);
  });

  it('checks socket actions limit', () => {
    const sockLimiter = new SocketRateLimiter();
    const now = 10_000;

    for (let i = 0; i < 20; i++) {
      expect(sockLimiter.checkAction(now)).toBe(true);
    }
    // 21st action in window -> blocked
    expect(sockLimiter.checkAction(now)).toBe(false);
  });
});
