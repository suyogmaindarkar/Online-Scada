import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // 🛑 CRITICAL: Do NOT generate source maps in production
    // This stops DevTools from showing your original .jsx/.js source files!
    sourcemap: false,

    // 🔒 Code Minification & Obfuscation
    minify: 'terser',
    terserOptions: {
      compress: {
        // Drop all console.log, console.warn, console.error in production
        drop_console: true,
        // Drop all debugger statements
        drop_debugger: true,
      },
      format: {
        // Remove all code comments from bundled production JS
        comments: false,
      },
    },

    // Chunk size warnings threshold
    chunkSizeWarningLimit: 1000,
  },
  server: {
    port: 5173,
    host: true,
  },
});