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
    setupFiles: ['./vitest.setup.ts']
  },
  resolve: {
    alias: {
      '@piq/core': '/packages/core/src',
      '@piq/click-tracker': '/packages/trackers/click-tracker/src',
      '@piq/utils': '/packages/utils/src'
    }
  }
});