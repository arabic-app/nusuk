import { defineConfig, Plugin } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function servePublicOrtPlugin(): Plugin {
  return {
    name: 'serve-public-ort',
    enforce: 'pre',
    resolveId(id) {
      const clean = id.split('?')[0];
      if (clean.startsWith('/vendor/ort/') && (clean.endsWith('.mjs') || clean.endsWith('.js'))) {
        return '\0' + clean;
      }
    },
    load(id) {
      if (
        id.startsWith('\0/vendor/ort/') ||
        (id.startsWith('/vendor/ort/') && (id.endsWith('.mjs') || id.endsWith('.js')))
      ) {
        const rawId = id.startsWith('\0') ? id.slice(1) : id;
        const filePath = path.resolve(__dirname, 'public', rawId.slice(1));
        if (fs.existsSync(filePath)) {
          return fs.readFileSync(filePath, 'utf-8');
        }
      }
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0];

        // Route manifest based on brand / host in dev mode
        if (url === '/manifest.webmanifest') {
          const host = (req.headers.host || '').toLowerCase();
          const query = req.url?.includes('?') ? req.url.split('?')[1] : '';
          const isNusuk = host.includes('nusuk') || query.includes('brand=nusuk');
          if (!isNusuk) {
            const portraitPath = path.resolve(__dirname, 'public/manifest-portrait.webmanifest');
            if (fs.existsSync(portraitPath)) {
              res.setHeader('Content-Type', 'application/manifest+json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              return res.end(fs.readFileSync(portraitPath));
            }
          }
        }

        if (url && (url.startsWith('/vendor/ort/') || url.startsWith('/models/') || url.endsWith('.webmanifest'))) {
          const filePath = path.resolve(__dirname, 'public', url.slice(1));
          if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            if (url.endsWith('.mjs') || url.endsWith('.js')) {
              res.setHeader('Content-Type', 'application/javascript');
            } else if (url.endsWith('.wasm')) {
              res.setHeader('Content-Type', 'application/wasm');
            } else if (url.endsWith('.onnx')) {
              res.setHeader('Content-Type', 'application/octet-stream');
            } else if (url.endsWith('.json') || url.endsWith('.webmanifest')) {
              res.setHeader('Content-Type', 'application/manifest+json');
            }
            res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
            res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
            return res.end(fs.readFileSync(filePath));
          }
        }
        next();
      });
    }
  };
}

export default defineConfig({
  plugins: [
    servePublicOrtPlugin(),
    preact(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['anti-fouc.js', 'manifest-portrait.webmanifest', 'manifest-nusuk.webmanifest'],
      manifest: {
        id: '/',
        name: 'Nusuk Photo — Recadrage photo Hajj & Omra',
        short_name: 'Nusuk Photo',
        description: "Recadrage et mise en conformité de photos d'identité pour le portail Hajj Nusuk (480x640, fond blanc, < 1 Mo).",
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        categories: ['productivity', 'utilities', 'photo'],
        theme_color: '#006C35',
        background_color: '#F6F8F6',
        icons: [
          {
            src: '/icons/pwa-64x64.png',
            sizes: '64x64',
            type: 'image/png'
          },
          {
            src: '/icons/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icons/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: '/icons/maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json,wasm,onnx,webmanifest}'],
        globIgnores: ['**/assets/*.wasm'],
        maximumFileSizeToCacheInBytes: 35 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/models/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'nusuk-models-cache',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/vendor/ort/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'nusuk-ort-wasm-cache',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/locales/'),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'nusuk-locales-cache',
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
  ],
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp'
    }
  },
  worker: {
    format: 'es',
    plugins: () => [servePublicOrtPlugin()]
  }
});
