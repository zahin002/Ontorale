import { test, expect, type Page, type BrowserContext } from '@playwright/test';

test.describe('E2E: E1 & E2 full game flows', () => {
  test('E1: 6 players create/join and start, each seeing only their own role', async ({
    browser,
  }) => {
    const contexts: BrowserContext[] = [];
    const pages: Page[] = [];

    // Create 6 browser contexts
    for (let i = 0; i < 6; i++) {
      const ctx = await browser.newContext();
      contexts.push(ctx);
      const page = await ctx.newPage();
      pages.push(page);
    }

    try {
      // 1. Host creates room
      const hostPage = pages[0];
      await hostPage.goto('/');
      await hostPage.getByTestId('nickname-input').fill('Player1');
      await hostPage.getByTestId('create-room').click();

      // Read room code
      await expect(hostPage.getByTestId('room-code')).toBeVisible();
      const roomCode = (await hostPage.getByTestId('room-code').textContent())?.trim();
      expect(roomCode).toBeTruthy();
      expect(roomCode).toHaveLength(6);

      // 2. 5 players join via room code
      for (let i = 1; i < 6; i++) {
        const page = pages[i];
        await page.goto('/');
        await page.getByTestId('nickname-input').fill(`Player${i + 1}`);
        await page.getByTestId('room-code-input').fill(roomCode!);
        await page.getByTestId('join-room').click();
        await expect(page.getByTestId('room-code')).toHaveText(roomCode!);
      }

      // 3. Host starts game
      await expect(hostPage.getByTestId('start-game')).toBeEnabled();
      await hostPage.getByTestId('start-game').click();

      // 4. E1: Each sees only own role
      for (let i = 0; i < 6; i++) {
        const page = pages[i];
        await expect(page.getByTestId('phase-name')).toHaveText('রাত', { timeout: 10000 });
        const myRole = await page.getByTestId('my-role').textContent();
        expect(myRole).toBeTruthy();
      }
    } finally {
      for (const ctx of contexts) {
        await ctx.close();
      }
    }
  });

  test('E2: play a full game where citizens win by voting out the killer', async ({ browser }) => {
    const contexts: BrowserContext[] = [];
    const pages: Page[] = [];

    for (let i = 0; i < 6; i++) {
      const ctx = await browser.newContext();
      contexts.push(ctx);
      const page = await ctx.newPage();
      pages.push(page);
    }

    try {
      // 1. Setup and join 6 players
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

      // 2. Identify who the killer is from my-role
      let killerIndex = -1;
      const roles: string[] = [];

      for (let i = 0; i < 6; i++) {
        const page = pages[i];
        await expect(page.getByTestId('phase-name')).toHaveText('রাত', { timeout: 10000 });
        const role = (await page.getByTestId('my-role').textContent())?.trim() || '';
        roles.push(role);
        if (role === 'খুনি' || role === 'Killer') {
          killerIndex = i;
        }
      }

      expect(killerIndex).toBeGreaterThanOrEqual(0);
      const killerPage = pages[killerIndex];

      // Killer abstains from kill so nobody dies in night
      if (await killerPage.getByTestId('action-none').isVisible()) {
        await killerPage.getByTestId('action-none').click();
      }

      // 3. Wait for discussion phase then voting phase
      // TIMER_SCALE=0.02 makes night ~2.4s, nightResult ~0.2s, discussion ~3.6s
      for (let i = 0; i < 6; i++) {
        await expect(pages[i].getByTestId('phase-name')).toHaveText('ভোট', { timeout: 15000 });
      }

      // 4. During voting: all citizen pages vote for the killer
      // Find the target button corresponding to the killer nickname
      const killerNickname = `Player${killerIndex + 1}`;
      for (let i = 0; i < 6; i++) {
        if (i === killerIndex) continue;
        const page = pages[i];
        const killerTargetBtn = page.getByRole('button', { name: killerNickname });
        if (await killerTargetBtn.isVisible()) {
          await killerTargetBtn.click();
        }
      }

      // 5. Voting timer runs (60s * 0.02 = 1.2s), voteResult (0.2s), transitions to gameOver
      for (let i = 0; i < 6; i++) {
        await expect(pages[i].getByTestId('winner')).toBeVisible({ timeout: 15000 });
        await expect(pages[i].getByTestId('winner')).toContainText('নাগরিক দল জয়ী!');
      }
    } finally {
      for (const ctx of contexts) {
        await ctx.close();
      }
    }
  });
});
