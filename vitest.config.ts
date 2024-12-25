import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['**/node_modules/**', '**/dist/**', '**/coverage/**', '**/*.config.*']
    },
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    passWithNoTests: true,
  },
  resolve: {
    alias: {
      '@clue/core': '/packages/core/src',
      '@clue/click-tracker': '/packages/trackers/click-tracker/src',
      '@clue/utils': '/packages/utils/src'
    }
  },
});