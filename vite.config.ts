import { defineConfig, Plugin } from 'vite';
import preact from '@preact/preset-vite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function servePublicOrtPlugin(): Plugin {
  return {
    name: 'serve-public-ort',
    resolveId(id) {
      if (id.startsWith('/vendor/ort/') && (id.endsWith('.mjs') || id.endsWith('.js'))) {
        return path.resolve(__dirname, 'public', id.slice(1));
      }
    },
    load(id) {
      if (id.includes('/public/vendor/ort/') && (id.endsWith('.mjs') || id.endsWith('.js'))) {
        if (fs.existsSync(id)) {
          return fs.readFileSync(id, 'utf-8');
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
  plugins: [preact(), servePublicOrtPlugin()],
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp'
    }
  },
  worker: {
    format: 'es'
  }
});
