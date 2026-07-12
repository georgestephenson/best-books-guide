import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Same-origin in prod (Nginx serves the SPA and proxies /api). In dev we emulate
// that by proxying /api and /healthz to the local API, so there's no CORS anywhere.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      '/healthz': 'http://localhost:3000',
    },
  },
  build: { outDir: 'dist', sourcemap: true },
});
