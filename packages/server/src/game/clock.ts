export interface Clock {
  now(): number;
  setTimeout(callback: () => void, ms: number): { unref?: () => void };
  clearTimeout(id: unknown): void;
}

export class SystemClock implements Clock {
  now(): number {
    return Date.now();
  }

  setTimeout(callback: () => void, ms: number): { unref?: () => void } {
    return setTimeout(callback, ms);
  }

  clearTimeout(id: unknown): void {
    clearTimeout(id as ReturnType<typeof setTimeout>);
  }
}

interface FakeTimer {
  id: number;
  runAt: number;
  callback: () => void;
}

export class FakeClock implements Clock {
  private currentTime: number;
  private nextTimerId = 1;
  private timers = new Map<number, FakeTimer>();

  constructor(initialTime = 1_000_000) {
    this.currentTime = initialTime;
  }

  now(): number {
    return this.currentTime;
  }

  setTimeout(callback: () => void, ms: number): { unref?: () => void } {
    const id = this.nextTimerId++;
    this.timers.set(id, {
      id,
      runAt: this.currentTime + ms,
      callback,
    });
    return {
      unref: () => {},
    };
  }

  clearTimeout(id: unknown): void {
    if (typeof id === 'number') {
      this.timers.delete(id);
    }
  }

  advanceBy(ms: number): void {
    const targetTime = this.currentTime + ms;
    while (true) {
      let earliest: FakeTimer | null = null;
      for (const timer of this.timers.values()) {
        if (timer.runAt <= targetTime) {
          if (!earliest || timer.runAt < earliest.runAt) {
            earliest = timer;
          }
        }
      }

      if (!earliest) break;

      this.currentTime = earliest.runAt;
      this.timers.delete(earliest.id);
      earliest.callback();
    }
    this.currentTime = targetTime;
  }
}
