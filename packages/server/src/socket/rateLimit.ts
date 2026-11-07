export class SlidingWindowRateLimiter {
  private requests = new Map<string, number[]>();

  constructor(
    private maxRequests: number,
    private windowMs: number,
  ) {}

  check(key: string, now: number = Date.now()): boolean {
    const timestamps = this.requests.get(key) || [];
    const validFrom = now - this.windowMs;
    const filtered = timestamps.filter((t) => t > validFrom);

    if (filtered.length >= this.maxRequests) {
      this.requests.set(key, filtered);
      return false;
    }

    filtered.push(now);
    this.requests.set(key, filtered);
    return true;
  }

  reset(key: string): void {
    this.requests.delete(key);
  }

  cleanup(now: number = Date.now()): void {
    const validFrom = now - this.windowMs;
    for (const [key, timestamps] of this.requests.entries()) {
      const filtered = timestamps.filter((t) => t > validFrom);
      if (filtered.length === 0) {
        this.requests.delete(key);
      } else {
        this.requests.set(key, filtered);
      }
    }
  }
}

export const ipRoomCreateLimiter = new SlidingWindowRateLimiter(3, 60_000); // 3 per minute

export class SocketRateLimiter {
  private chatLimiter = new SlidingWindowRateLimiter(5, 5_000); // 5 messages per 5s
  private actionLimiter = new SlidingWindowRateLimiter(20, 10_000); // 20 actions/votes per 10s
  private voiceLimiter = new SlidingWindowRateLimiter(6, 10_000); // 6 voice token requests per 10s

  checkChat(now?: number): boolean {
    return this.chatLimiter.check('chat', now);
  }

  checkAction(now?: number): boolean {
    return this.actionLimiter.check('action', now);
  }

  checkVoice(now?: number): boolean {
    return this.voiceLimiter.check('voice', now);
  }
}
