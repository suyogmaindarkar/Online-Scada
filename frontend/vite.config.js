import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],

  // 🔒 Code Protection & Optimization (Built-in esbuild)
  esbuild: {
    // Strip all console.log, console.warn, and debugger statements in production
    drop: ['console', 'debugger'],
  },

  build: {
    // 🛑 Do NOT generate source maps in production
    // (Prevents DevTools from recreating original .jsx source files)
    sourcemap: false,

    chunkSizeWarningLimit: 1000,
  },

  server: {
    port: 5173,
    host: true,
  },
});