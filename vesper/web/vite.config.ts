import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const API = process.env.VITE_API_TARGET ?? 'http://127.0.0.1:4000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: '0.0.0.0',
    allowedHosts: [
      'photograph-colleagues-moscow-expansion.trycloudflare.com',
    ],
    proxy: {
      '/api': {
        target: API,
        changeOrigin: true,
      },
      '/media': {
        target: API,
        changeOrigin: true,
      },
      '/socket.io': {
        target: API,
        ws: true,
        changeOrigin: true,
      },
    },
  },
  build: {
    sourcemap: false,
    chunkSizeWarningLimit: 900,
  },
});
