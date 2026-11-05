import { test, expect } from '@playwright/test';

test.describe('smoke check', () => {
  test('placeholder smoke', async () => {
    expect(true).toBe(true);
  });
});

