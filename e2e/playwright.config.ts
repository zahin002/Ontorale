import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const testPort = process.env.TEST_PORT || '3099';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: 'html',
  timeout: process.env.CI ? 60000 : 30000,
  use: {
    baseURL: `http://localhost:${testPort}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'node ../packages/server/dist/index.js',
    url: `http://localhost:${testPort}/healthz`,
    reuseExistingServer: false,
    cwd: __dirname,
    env: {
      NODE_ENV: 'test',
      TIMER_SCALE: '0.02',
      PORT: testPort,
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
