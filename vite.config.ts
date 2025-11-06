// vite.config.ts (UPDATED)

import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        ide: resolve(__dirname, 'ide.html'),
        simulation: resolve(__dirname, 'simulation-ide.html'),
      },
    },
  },
  server: {
    fs: {
      allow: ['..'],
    },
  },
  plugins: [
    {
      name: 'configure-response-headers',
      configureServer: server => {
        server.middlewares.use((req, res, next) => {
          if (req.url && (req.url.includes('/ide.html') || req.url.includes('/simulation-ide.html'))) {
            res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
            res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
          } else if (req.url && req.url === '/') {
          }
          next();
        });
      }
    }
  ],
});