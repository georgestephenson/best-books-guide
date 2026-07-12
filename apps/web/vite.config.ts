import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

// Same-origin in prod (Nginx serves the SPA and proxies /api). In dev we emulate
// that by proxying /api and /healthz to the local API, so there's no CORS anywhere.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // Bundle the shared package from source so dev/build don't need it pre-built.
    alias: {
      '@bestbooks/shared': fileURLToPath(
        new URL('../../packages/shared/src/index.ts', import.meta.url),
      ),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      '/healthz': 'http://localhost:3000',
    },
  },
  build: { outDir: 'dist', sourcemap: true },
});
