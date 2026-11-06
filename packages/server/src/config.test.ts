import { describe, it, expect } from 'vitest';
import { loadConfig } from './config';

describe('config module', () => {
  it('loads valid default configuration', () => {
    const config = loadConfig({
      NODE_ENV: 'development',
      PORT: '3000',
    });
    expect(config.PORT).toBe(3000);
    expect(config.NODE_ENV).toBe('development');
    expect(config.MAFIA_WIN_MODE).toBe('plusOne');
    expect(config.TIMER_SCALE).toBe(1);
    expect(config.MAX_ROOMS).toBe(20);
  });

  it('rejects production configuration when TIMER_SCALE is not 1', () => {
    expect(() =>
      loadConfig({
        NODE_ENV: 'production',
        TIMER_SCALE: '0.5',
      }),
    ).toThrow('TIMER_SCALE must be 1 in production mode');
  });

  it('rejects invalid PORT or options', () => {
    expect(() =>
      loadConfig({
        PORT: 'not-a-number',
      }),
    ).toThrow('Environment validation failed');
  });
});
