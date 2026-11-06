import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['packages/shared/src/**/*.test.ts', 'packages/server/src/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/test/integration/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['packages/shared/src/**/*.ts'],
      exclude: ['**/*.test.ts', '**/index.ts', '**/types.ts'],
    },
  },
});
