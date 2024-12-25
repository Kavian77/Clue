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
    passWithNoTests: true,
    setupFiles: ['../../vitest.setup.ts']
  }
});