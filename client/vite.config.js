import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const API = process.env.API_URL || 'http://localhost:3001';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: { manualChunks: { react: ['react', 'react-dom', 'react-router-dom'], charts: ['recharts'] } },
    },
    chunkSizeWarningLimit: 700,
  },
  server: {
    host: true, // accesible desde el celular en la red local
    port: 5173,
    proxy: {
      '/api': API,
      '/uploads': API,
      '/ws': { target: API.replace('http', 'ws'), ws: true },
    },
  },
});
