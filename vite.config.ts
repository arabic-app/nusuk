import { defineConfig, Plugin } from 'vite';
import preact from '@preact/preset-vite';
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
        if (url && (url.startsWith('/vendor/ort/') || url.startsWith('/models/'))) {
          const filePath = path.resolve(__dirname, 'public', url.slice(1));
          if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            if (url.endsWith('.mjs') || url.endsWith('.js')) {
              res.setHeader('Content-Type', 'application/javascript');
            } else if (url.endsWith('.wasm')) {
              res.setHeader('Content-Type', 'application/wasm');
            } else if (url.endsWith('.onnx')) {
              res.setHeader('Content-Type', 'application/octet-stream');
            } else if (url.endsWith('.json')) {
              res.setHeader('Content-Type', 'application/json');
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
  plugins: [servePublicOrtPlugin(), preact()],
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
