import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // TODO: Remove these once the packages are published
      '@piq/core': '../../../packages/core/src',
      '@piq/click-tracker': '../../../packages/trackers/click-tracker/src',
    },
  },
});
