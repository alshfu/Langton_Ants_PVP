import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@':         path.resolve(__dirname, './src'),
      '@core':     path.resolve(__dirname, './src/core'),
      '@theme':    path.resolve(__dirname, './src/theme'),
      '@i18n':     path.resolve(__dirname, './src/i18n'),
      '@state':    path.resolve(__dirname, './src/state'),
      '@ui':       path.resolve(__dirname, './src/ui'),
      '@components': path.resolve(__dirname, './src/components'),
      '@screens':  path.resolve(__dirname, './src/screens'),
      '@router':   path.resolve(__dirname, './src/router'),
      '@lib':      path.resolve(__dirname, './src/lib'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./src/test-setup.ts'],
  },
});
