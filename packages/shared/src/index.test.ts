import { describe, it, expect } from 'vitest';
import { VERSION } from './index';

describe('shared module', () => {
  it('exports version', () => {
    expect(VERSION).toBe('1.0.0');
  });
});
