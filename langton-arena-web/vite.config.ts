import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// https://vitejs.dev/config/
export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/Langton_Ants_PVP/' : '/',
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
  server: {
    port: 5173,
    host: '0.0.0.0',
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
        },
      },
    },
  },
});
