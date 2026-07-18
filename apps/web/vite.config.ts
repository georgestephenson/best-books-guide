import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
import { createReadStream, existsSync } from 'node:fs';
import { join, normalize } from 'node:path';

// Dev-only: serve imported covers from the API's local media dir at /covers/. In prod
// Nginx owns this (roles/nginx §/covers/); the API never handles it. Kept here so
// covers show up locally without running Nginx.
function serveCoversInDev(): Plugin {
  const mediaDir = fileURLToPath(new URL('../api/media/', import.meta.url));
  return {
    name: 'serve-covers-dev',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/covers', (req, res, next) => {
        const rel = normalize(decodeURIComponent((req.url ?? '/').split('?')[0]!));
        const file = join(mediaDir, rel);
        if (!file.startsWith(mediaDir) || !existsSync(file)) return next(); // traversal / miss → fall through
        res.setHeader('Content-Type', 'image/jpeg');
        createReadStream(file).pipe(res);
      });
    },
  };
}

// Same-origin in prod (Nginx serves the SPA and proxies /api). In dev we emulate
// that by proxying /api and /healthz to the local API, so there's no CORS anywhere.
export default defineConfig({
  plugins: [react(), tailwindcss(), serveCoversInDev()],
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
