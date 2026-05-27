import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Stage 8 Day 1 — engine moved to backend/core/src/.
    alias: [
      { find: /^@core\/langton\/(.*)$/,  replacement: path.resolve(__dirname, '../langton-arena-backend/core/src/langton/$1') },
      { find: /^@core\/contract\/(.*)$/, replacement: path.resolve(__dirname, '../langton-arena-backend/core/src/contract/$1') },
      { find: /^@core\/shared\/(.*)$/,   replacement: path.resolve(__dirname, './src/core/shared/$1') },
      { find: '@langton/core',           replacement: path.resolve(__dirname, '../langton-arena-backend/core/src/index.ts') },
      { find: /^@core\/(.*)$/,           replacement: path.resolve(__dirname, './src/core/$1') },
      { find: /^@theme\/(.*)$/,          replacement: path.resolve(__dirname, './src/theme/$1') },
      { find: /^@i18n\/(.*)$/,           replacement: path.resolve(__dirname, './src/i18n/$1') },
      { find: /^@state\/(.*)$/,          replacement: path.resolve(__dirname, './src/state/$1') },
      { find: /^@ui\/(.*)$/,             replacement: path.resolve(__dirname, './src/ui/$1') },
      { find: /^@components\/(.*)$/,     replacement: path.resolve(__dirname, './src/components/$1') },
      { find: /^@screens\/(.*)$/,        replacement: path.resolve(__dirname, './src/screens/$1') },
      { find: /^@router\/(.*)$/,         replacement: path.resolve(__dirname, './src/router/$1') },
      { find: /^@lib\/(.*)$/,            replacement: path.resolve(__dirname, './src/lib/$1') },
      { find: /^@\/(.*)$/,               replacement: path.resolve(__dirname, './src/$1') },
    ],
  },
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./src/test-setup.ts'],
  },
});
