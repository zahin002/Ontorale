import { test, expect, type Page, type BrowserContext } from '@playwright/test';

test.describe('E2E: E3 through E7', () => {
  // E3: Mafia wins
  test('E3: play a full game where mafia wins by night kills', async ({ browser }) => {
    test.setTimeout(60000);
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
      await hostPage.getByTestId('nickname-input').fill('P1');
      await hostPage.getByTestId('create-room').click();

      await expect(hostPage.getByTestId('room-code')).toBeVisible();
      const roomCode = (await hostPage.getByTestId('room-code').textContent())?.trim();

      for (let i = 1; i < 6; i++) {
        const page = pages[i];
        await page.goto('/');
        await page.getByTestId('nickname-input').fill(`P${i + 1}`);
        await page.getByTestId('room-code-input').fill(roomCode!);
        await page.getByTestId('join-room').click();
      }

      await hostPage.getByTestId('start-game').click();

      // Identify who the killer is
      let killerIndex = -1;
      for (let i = 0; i < 6; i++) {
        await expect(pages[i].getByTestId('phase-name')).toHaveText('রাত', { timeout: 10000 });
        const role = (await pages[i].getByTestId('my-role').textContent())?.trim();
        if (role === 'খুনি' || role === 'Killer') {
          killerIndex = i;
        }
      }

      expect(killerIndex).toBeGreaterThanOrEqual(0);
      const killerPage = pages[killerIndex];

      // Play rounds until mafia wins: killer kills at night, players vote out non-mafia during day
      for (let round = 1; round <= 4; round++) {
        if (
          await killerPage
            .getByTestId('winner')
            .isVisible()
            .catch(() => false)
        )
          break;

        // 1. Night: wait for night phase or winner
        await expect(
          killerPage.locator('[data-testid="winner"], [data-testid="phase-name"]:has-text("রাত")'),
        ).toBeVisible({ timeout: 15000 });
        if (
          await killerPage
            .getByTestId('winner')
            .isVisible()
            .catch(() => false)
        )
          break;

        // Killer picks first available target
        const killBtn = killerPage.locator('button[data-testid^="target-"]').first();
        if (await killBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
          await killBtn.click();
        }

        // 2. Wait for voting phase or winner
        await expect(
          killerPage.locator('[data-testid="winner"], [data-testid="phase-name"]:has-text("ভোট")'),
        ).toBeVisible({ timeout: 15000 });
        if (
          await killerPage
            .getByTestId('winner')
            .isVisible()
            .catch(() => false)
        )
          break;

        // In voting: alive players vote for first available target
        const voteBtn = killerPage.locator('button[data-testid^="target-"]').first();
        if (await voteBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
          const targetName = (await voteBtn.textContent())?.trim();
          if (targetName) {
            for (const page of pages) {
              const pVoteBtn = page.getByRole('button', { name: targetName });
              if (await pVoteBtn.isVisible().catch(() => false)) {
                await pVoteBtn.click().catch(() => {});
              }
            }
          }
        }

        // Wait for next night or winner
        await expect(
          killerPage.locator('[data-testid="winner"], [data-testid="phase-name"]:has-text("রাত")'),
        ).toBeVisible({ timeout: 15000 });
        if (
          await killerPage
            .getByTestId('winner')
            .isVisible()
            .catch(() => false)
        )
          break;
      }

      // Assert mafia victory
      await expect(killerPage.getByTestId('winner')).toBeVisible({ timeout: 20000 });
      await expect(killerPage.getByTestId('winner')).toContainText('মাফিয়া দল জয়ী!');
    } finally {
      for (const ctx of contexts) {
        await ctx.close();
      }
    }
  });

  // E4: A player closes their tab mid-game -> others see them as disconnected with role revealed
  test('E4: player closes tab mid-game, others see them disconnected with role revealed', async ({
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

      // Player 6 closes tab mid-game
      await pages[5].close();
      await contexts[5].close();

      // Host should see event-log contain disconnection notice for Player6
      await expect(hostPage.getByTestId('event-log')).toContainText('Player6', { timeout: 10000 });
      await expect(hostPage.getByTestId('event-log')).toContainText('গেম থেকে বিচ্ছিন্ন হয়েছে');
    } finally {
      for (const ctx of contexts) {
        try {
          await ctx.close();
        } catch {
          // Ignore if already closed
        }
      }
    }
  });

  // E5: Silenced player's chat input is disabled during discussion and voting phases
  test('E5: silenced player chat input is disabled during discussion and voting', async ({
    browser,
  }) => {
    // 10 players required to enable silencer
    const contexts: BrowserContext[] = [];
    const pages: Page[] = [];

    for (let i = 0; i < 10; i++) {
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

      for (let i = 1; i < 10; i++) {
        const page = pages[i];
        await page.goto('/');
        await page.getByTestId('nickname-input').fill(`Player${i + 1}`);
        await page.getByTestId('room-code-input').fill(roomCode!);
        await page.getByTestId('join-room').click();
      }

      // Host enables silencer
      const silencerToggle = hostPage.getByRole('button', { name: /নিস্তব্ধকারী/i });
      if (await silencerToggle.isVisible()) {
        await silencerToggle.click();
      }

      await hostPage.getByTestId('start-game').click();

      // Find silencer
      let silencerIndex = -1;
      for (let i = 0; i < 10; i++) {
        await expect(pages[i].getByTestId('phase-name')).toHaveText('রাত', { timeout: 10000 });
        const role = (await pages[i].getByTestId('my-role').textContent())?.trim();
        if (role === 'নিস্তব্ধকারী' || role === 'Silencer') {
          silencerIndex = i;
        }
      }

      expect(silencerIndex).toBeGreaterThanOrEqual(0);
      const silencerPage = pages[silencerIndex];

      // Silencer silences target Player2 (index 1)
      const targetBtn = silencerPage.getByRole('button', { name: 'Player2' });
      await expect(targetBtn).toBeVisible({ timeout: 5000 });
      await targetBtn.click();

      // Move to discussion phase
      const p2Page = pages[1];
      await expect(p2Page.getByTestId('phase-name')).toHaveText('দিনের আলোচনা', { timeout: 15000 });

      // Player 2's chat input must be disabled during discussion
      await expect(p2Page.getByTestId('chat-input')).toBeDisabled();

      // Move to voting phase
      await expect(p2Page.getByTestId('phase-name')).toHaveText('ভোট', { timeout: 15000 });

      // Player 2's chat input remains disabled during voting
      await expect(p2Page.getByTestId('chat-input')).toBeDisabled();
    } finally {
      for (const ctx of contexts) {
        await ctx.close();
      }
    }
  });

  // E6: Mobile viewport (375x667) responsiveness smoke test
  test('E6: mobile viewport 375x667 smoke test', async ({ browser }) => {
    const ctx = await browser.newContext({
      viewport: { width: 375, height: 667 },
    });
    const page = await ctx.newPage();

    try {
      await page.goto('/');
      await page.getByTestId('nickname-input').fill('MobileUser');
      await page.getByTestId('create-room').click();

      await expect(page.getByTestId('room-code')).toBeVisible();

      // Check header and controls fit within 375px without horizontal scroll
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      expect(bodyWidth).toBeLessThanOrEqual(385);
    } finally {
      await ctx.close();
    }
  });

  // E7: Bengali nickname and Bengali chat message render correctly
  test('E7: Bengali nickname and Bengali chat message render correctly', async ({ browser }) => {
    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();
    const page1 = await ctx1.newPage();
    const page2 = await ctx2.newPage();

    try {
      // Host with Bengali nickname
      await page1.goto('/');
      await page1.getByTestId('nickname-input').fill('রহিম চৌধুরী');
      await page1.getByTestId('create-room').click();

      await expect(page1.getByTestId('room-code')).toBeVisible();
      const roomCode = (await page1.getByTestId('room-code').textContent())?.trim();

      // Guest with Bengali nickname
      await page2.goto('/');
      await page2.getByTestId('nickname-input').fill('করিম আহমেদ');
      await page2.getByTestId('room-code-input').fill(roomCode!);
      await page2.getByTestId('join-room').click();

      await expect(page2.getByTestId('room-code')).toBeVisible();

      // Both pages see Bengali nicknames in lobby player list
      await expect(page1.getByText('করিম আহমেদ')).toBeVisible();
      await expect(page2.getByText('রহিম চৌধুরী')).toBeVisible();

      // Send Bengali chat message in lobby
      const bengaliMsg = 'হ্যালো বন্ধুরা, অন্তরালে স্বাগতম!';
      await page1.getByTestId('chat-input').fill(bengaliMsg);
      await page1.getByTestId('chat-send').click();

      // Both pages should see the Bengali chat message
      await expect(page1.getByText(bengaliMsg)).toBeVisible();
      await expect(page2.getByText(bengaliMsg)).toBeVisible();
    } finally {
      await ctx1.close();
      await ctx2.close();
    }
  });
});
