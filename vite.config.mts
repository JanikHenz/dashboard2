import { resolve } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const API_TARGET = process.env.API_TARGET ?? 'http://localhost:8080';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': resolve(import.meta.dirname, 'src') }
  },
  server: {
    port: 5173,
    proxy: {
      '/api': API_TARGET,
      '/ws': { target: API_TARGET, ws: true }
    }
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        dashboard: resolve(import.meta.dirname, 'index.html'),
        detail: resolve(import.meta.dirname, 'app-detail.html')
      }
    }
  }
});
