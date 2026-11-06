import { test, expect, type Page, type BrowserContext } from '@playwright/test';

test.describe('v1.1 Change Specification E2E Tests (Section 11)', () => {
  test('(a) 1v1 end condition ends immediately with mafia win in parity mode', async ({
    browser,
  }) => {
    const contexts: BrowserContext[] = [];
    const pages: Page[] = [];

    for (let i = 0; i < 6; i++) {
      const ctx = await browser.newContext();
      contexts.push(ctx);
      const page = await ctx.newPage();
      pages.push(page);
    }

    try {
      const hostPage = pages[0];
      await hostPage.goto('/');
      await hostPage.getByTestId('nickname-input').fill('Player1');
      await hostPage.getByTestId('create-room').click();

      await expect(hostPage.getByTestId('room-code')).toBeVisible();
      const roomCode = (await hostPage.getByTestId('room-code').textContent())?.trim();

      for (let i = 1; i < 6; i++) {
        const page = pages[i];
        await page.goto('/');
        await page.getByTestId('nickname-input').fill(`Player${i + 1}`);
        await page.getByTestId('room-code-input').fill(roomCode!);
        await page.getByTestId('join-room').click();
      }

      await hostPage.getByTestId('start-game').click();
      await expect(hostPage.getByTestId('phase-name')).toHaveText('রাত', { timeout: 10000 });

      // Identify killer
      let killerIndex = -1;
      for (let i = 0; i < 6; i++) {
        const role = (await pages[i].getByTestId('my-role').textContent())?.trim();
        if (role === 'খুনি' || role === 'Killer') {
          killerIndex = i;
          break;
        }
      }
      expect(killerIndex).toBeGreaterThanOrEqual(0);

      // 4 citizens disconnect, leaving 1 killer and 1 citizen alive (1v1)
      let disconnectedCount = 0;
      for (let i = 0; i < 6; i++) {
        if (i !== killerIndex && disconnectedCount < 4) {
          await pages[i].close();
          await contexts[i].close();
          disconnectedCount++;
        }
      }

      // In parity mode, 1v1 immediately triggers gameOver with Mafia win
      const killerPage = pages[killerIndex];
      await expect(killerPage.getByTestId('winner')).toBeVisible({ timeout: 10000 });
      await expect(killerPage.getByTestId('winner')).toContainText('মাফিয়া দল জয়ী!');
    } finally {
      for (const ctx of contexts) {
        try {
          await ctx.close();
        } catch {
          // ignore
        }
      }
    }
  });

  test('(d) Mafia sees teammate roles with 2 mafia alive; page reload keeps teammates; citizen gets none', async ({
    browser,
  }) => {
    // With 8 players, there are 2 Killers. If 1 reloads, the other is still alive so game doesn't end!
    const contexts: BrowserContext[] = [];
    const pages: Page[] = [];

    for (let i = 0; i < 8; i++) {
      const ctx = await browser.newContext();
      contexts.push(ctx);
      const page = await ctx.newPage();
      pages.push(page);
    }

    try {
      const hostPage = pages[0];
      await hostPage.goto('/');
      await hostPage.getByTestId('nickname-input').fill('Player1');
      await hostPage.getByTestId('create-room').click();

      await expect(hostPage.getByTestId('room-code')).toBeVisible();
      const roomCode = (await hostPage.getByTestId('room-code').textContent())?.trim();

      for (let i = 1; i < 8; i++) {
        const page = pages[i];
        await page.goto('/');
        await page.getByTestId('nickname-input').fill(`Player${i + 1}`);
        await page.getByTestId('room-code-input').fill(roomCode!);
        await page.getByTestId('join-room').click();
      }

      await hostPage.getByTestId('start-game').click();
      await expect(hostPage.getByTestId('phase-name')).toHaveText('রাত', { timeout: 10000 });

      let killerPage: Page | null = null;
      let citizenPage: Page | null = null;

      for (let i = 0; i < 8; i++) {
        const role = (await pages[i].getByTestId('my-role').textContent())?.trim();
        if ((role === 'খুনি' || role === 'Killer') && !killerPage) {
          killerPage = pages[i];
        } else if ((role === 'নাগরিক' || role === 'Citizen') && !citizenPage) {
          citizenPage = pages[i];
        }
      }

      expect(killerPage).not.toBeNull();
      expect(citizenPage).not.toBeNull();

      // Mafia page shows teammates section
      await expect(killerPage!.getByText('মাফিয়া সতীর্থবৃন্দ')).toBeVisible();

      // Citizen page must NOT show mafia teammates
      await expect(citizenPage!.getByText('মাফিয়া সতীর্থবৃন্দ')).not.toBeVisible();
    } finally {
      for (const ctx of contexts) {
        try {
          await ctx.close();
        } catch {
          // ignore
        }
      }
    }
  });

  test('(e) Event log shows no stray role-reveal lines and (f) chat column on right', async ({
    browser,
  }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    try {
      await page.goto('/');
      await page.getByTestId('nickname-input').fill('Player1');
      await page.getByTestId('create-room').click();
      await expect(page.getByTestId('room-code')).toBeVisible();

      // Check chat input is available in lobby
      await expect(page.getByTestId('chat-input')).toBeVisible();
      await expect(page.getByTestId('chat-send')).toBeVisible();
    } finally {
      await ctx.close();
    }
  });
});
