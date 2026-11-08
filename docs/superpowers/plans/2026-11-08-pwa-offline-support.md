# PWA & 100% Offline Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform Nusuk Photo into an installable Progressive Web App (PWA) with full 100% offline support including the ONNX AI segmentation model and WebAssembly runtime.

**Architecture:** Use `vite-plugin-pwa` with Workbox configured in `autoUpdate` mode. Cache the app shell, i18n locales, ONNX WebAssembly runtime (`/vendor/ort/`), and MODNet quantized model (`/models/modnet/`) using a 35 MB precache limit and `CacheFirst` runtime caching. Fix existing TypeScript preset property errors to enable clean production compilation.

**Tech Stack:** Preact, Vite 6, TypeScript, `vite-plugin-pwa`, Workbox, Vitest.

**Spec:** [`docs/superpowers/specs/2026-11-08-pwa-offline-support-design.md`](file:///Users/hamdi/Desktop/AI_Projects/nusuk/docs/superpowers/specs/2026-11-08-pwa-offline-support-design.md)

## Global Constraints

- Full offline operation: the app shell, wasm binaries (`/vendor/ort/*`), and model files (`/models/modnet/*`) must be cached so that background removal and photo cropping work without network connectivity.
- Native browser install prompt only: no custom install banner or button in the app UI.
- Background silent updates: `registerType: 'autoUpdate'` with immediate client claim.
- TypeScript strictness: `npm run build` (`tsc && vite build`) must succeed with 0 errors.
- Test preservation: all 151 existing tests must continue to pass without regression.

---

### Task 1: Fix TypeScript Build Errors in Sheet Presets

**Files:**
- Modify: `src/components/ActionBar.tsx:37-43`
- Modify: `src/components/SheetPreviewModal.tsx:98-105`
- Test: `tests/dimensions.test.ts`

**Interfaces:**
- Consumes: `SHEET_PRESETS` from `src/utils/dimensions.ts` (type `Record<Exclude<SheetPreset, 'custom'>, { width: number; height: number; unit: Unit; dpi: number }>`)
- Produces: Correct label formatting without `.name` access

- [ ] **Step 1: Verify the build failure**

Run: `npx tsc --noEmit`  
Expected: TS2339 error indicating property 'name' does not exist on type `{ width: number; height: number; unit: Unit; dpi: number }` in `ActionBar.tsx` and `SheetPreviewModal.tsx`.

- [ ] **Step 2: Fix preset label in `src/components/ActionBar.tsx`**

In `src/components/ActionBar.tsx`, replace lines 37-43:
```tsx
  const isSheet = sheetConfig?.enabled;
  const sheetPresetLabel = sheetConfig
    ? sheetConfig.preset === 'custom'
      ? `${sheetConfig.width}×${sheetConfig.height} ${sheetConfig.unit}`
      : `${sheetConfig.preset.toUpperCase()} (${SHEET_PRESETS[sheetConfig.preset]?.width}×${SHEET_PRESETS[sheetConfig.preset]?.height} ${SHEET_PRESETS[sheetConfig.preset]?.unit})`
    : '';
```

- [ ] **Step 3: Fix preset label in `src/components/SheetPreviewModal.tsx`**

In `src/components/SheetPreviewModal.tsx`, replace line 103:
```tsx
  const presetLabel =
    sheetConfig.preset === 'custom'
      ? `${sheetConfig.width} × ${sheetConfig.height} ${sheetConfig.unit}`
      : `${sheetConfig.preset.toUpperCase()} (${SHEET_PRESETS[sheetConfig.preset]?.width}×${SHEET_PRESETS[sheetConfig.preset]?.height} ${SHEET_PRESETS[sheetConfig.preset]?.unit})`;
```

- [ ] **Step 4: Verify TypeScript compilation**

Run: `npx tsc --noEmit`  
Expected: Exit code 0 with no errors.

- [ ] **Step 5: Run tests**

Run: `npm test`  
Expected: All 151 tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/ActionBar.tsx src/components/SheetPreviewModal.tsx
git commit -m "fix(types): resolve SHEET_PRESETS label formatting for tsc build"
```

---

### Task 2: Install `vite-plugin-pwa` and Generate PWA Icons

**Files:**
- Create: `public/icons/pwa-64x64.png`
- Create: `public/icons/pwa-192x192.png`
- Create: `public/icons/pwa-512x512.png`
- Create: `public/icons/maskable-icon-512x512.png`
- Create: `public/icons/apple-touch-icon-180x180.png`
- Create: `scripts/generate-pwa-icons.js`
- Test: `tests/pwa-assets.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: Node standard libraries (`fs`, `path`) and canvas/pure PNG buffer generation or SVG to PNG generator
- Produces: Valid PNG icons in `public/icons/` meeting standard W3C PWA dimensions

- [ ] **Step 1: Write failing test verifying PWA icon files and dimensions**

Create `tests/pwa-assets.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('PWA Assets', () => {
  const iconPaths = [
    'public/icons/pwa-64x64.png',
    'public/icons/pwa-192x192.png',
    'public/icons/pwa-512x512.png',
    'public/icons/maskable-icon-512x512.png',
    'public/icons/apple-touch-icon-180x180.png'
  ];

  it('contains all required PWA icons with non-zero file sizes', () => {
    for (const icon of iconPaths) {
      const fullPath = path.resolve(process.cwd(), icon);
      expect(fs.existsSync(fullPath), `Icon ${icon} should exist`).toBe(true);
      const stat = fs.statSync(fullPath);
      expect(stat.size).toBeGreaterThan(100);
    }
  });

  it('validates PNG header signature for generated icons', () => {
    for (const icon of iconPaths) {
      const fullPath = path.resolve(process.cwd(), icon);
      const buffer = fs.readFileSync(fullPath);
      // PNG magic bytes: 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A
      expect(buffer[0]).toBe(0x89);
      expect(buffer[1]).toBe(0x50);
      expect(buffer[2]).toBe(0x4e);
      expect(buffer[3]).toBe(0x47);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/pwa-assets.test.ts`  
Expected: FAIL (files do not exist yet).

- [ ] **Step 3: Install `vite-plugin-pwa`**

Run: `npm install -D vite-plugin-pwa`

- [ ] **Step 4: Create icon generator script and generate icons**

Create `scripts/generate-pwa-icons.js`:
This script uses pure Node.js (zlib + crc32 / uncompressed PNG chunk writer) to create valid PNG icons with the emerald background `#006C35` and gold Kaaba design without needing external C-bindings like `canvas`.

```javascript
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

function createPng(width, height, isMaskable = false) {
  // Simple uncompressed RGBA PNG generator
  const bytesPerPixel = 4;
  const rowSize = width * bytesPerPixel;
  const rawData = Buffer.alloc(height * (1 + rowSize));

  const bgR = 0x00, bgG = 0x6c, bgB = 0x35; // #006C35
  const goldR = 0xd4, goldG = 0xaf, goldB = 0x37; // Gold #D4AF37
  const blackR = 0x10, blackG = 0x10, blackB = 0x10;
  const whiteR = 0xff, whiteG = 0xff, whiteB = 0xff;

  // Kaaba box bounding relative to canvas
  const padding = isMaskable ? Math.round(width * 0.22) : Math.round(width * 0.18);
  const boxLeft = padding;
  const boxRight = width - padding;
  const boxTop = padding + Math.round(height * 0.05);
  const boxBottom = height - padding;
  const goldBandTop = boxTop + Math.round((boxBottom - boxTop) * 0.18);
  const goldBandBottom = goldBandTop + Math.max(2, Math.round(height * 0.04));

  let offset = 0;
  for (let y = 0; y < height; y++) {
    rawData[offset++] = 0; // Filter type: None
    for (let x = 0; x < width; x++) {
      let r = bgR, g = bgG, b = bgB, a = 255;

      if (x >= boxLeft && x <= boxRight && y >= boxTop && y <= boxBottom) {
        if (y >= goldBandTop && y <= goldBandBottom) {
          r = goldR; g = goldG; b = goldB;
        } else {
          r = blackR; g = blackG; b = blackB;
        }
        // Border outline
        if (x === boxLeft || x === boxRight || y === boxTop || y === boxBottom) {
          r = goldR; g = goldG; b = goldB;
        }
      }

      rawData[offset++] = r;
      rawData[offset++] = g;
      rawData[offset++] = b;
      rawData[offset++] = a;
    }
  }

  const deflated = zlib.deflateSync(rawData);

  function createChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4);
    const crcData = Buffer.concat([typeBuf, data]);
    const crc = crc32(crcData);
    crcBuf.writeUInt32BE(crc, 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  function crc32(buf) {
    let crc = -1;
    for (let i = 0; i < buf.length; i++) {
      crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
    }
    return (crc ^ -1) >>> 0;
  }

  const header = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  return Buffer.concat([
    header,
    createChunk('IHDR', ihdr),
    createChunk('IDAT', deflated),
    createChunk('IEND', Buffer.alloc(0))
  ]);
}

const table = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  table[i] = c;
}

const iconsDir = path.resolve(process.cwd(), 'public/icons');
fs.mkdirSync(iconsDir, { recursive: true });

const targets = [
  { name: 'pwa-64x64.png', size: 64, maskable: false },
  { name: 'pwa-192x192.png', size: 192, maskable: false },
  { name: 'pwa-512x512.png', size: 512, maskable: false },
  { name: 'maskable-icon-512x512.png', size: 512, maskable: true },
  { name: 'apple-touch-icon-180x180.png', size: 180, maskable: false },
];

for (const t of targets) {
  const buf = createPng(t.size, t.size, t.maskable);
  fs.writeFileSync(path.join(iconsDir, t.name), buf);
  console.log(`Generated ${t.name} (${t.size}x${t.size})`);
}
```

Run: `node scripts/generate-pwa-icons.js`

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/pwa-assets.test.ts`  
Expected: PASS with 2 tests passing.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json scripts/generate-pwa-icons.js public/icons/ tests/pwa-assets.test.ts
git commit -m "feat(pwa): install vite-plugin-pwa and generate standard PWA icons"
```

---

### Task 3: Configure Vite PWA, Workbox Caching & HTML Metadata

**Files:**
- Modify: `vite.config.ts`
- Modify: `index.html`
- Modify: `src/vite-env.d.ts`
- Modify: `src/main.tsx`
- Create: `tests/pwa-config.test.ts`

**Interfaces:**
- Consumes: `VitePWA` from `vite-plugin-pwa`
- Produces: Service Worker with 35 MB precache limit and `/models/` + `/vendor/ort/` runtime caches

- [ ] **Step 1: Write test validating PWA manifest and config**

Create `tests/pwa-config.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('PWA Configuration and Registration', () => {
  it('has meta tags and apple touch icon in index.html', () => {
    const html = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf-8');
    expect(html).toContain('<meta name="theme-color" content="#006C35"');
    expect(html).toContain('apple-touch-icon');
  });

  it('includes vite-plugin-pwa client reference in vite-env.d.ts', () => {
    const env = fs.readFileSync(path.resolve(process.cwd(), 'src/vite-env.d.ts'), 'utf-8');
    expect(env).toContain('vite-plugin-pwa/client');
  });

  it('registers the service worker in src/main.tsx', () => {
    const main = fs.readFileSync(path.resolve(process.cwd(), 'src/main.tsx'), 'utf-8');
    expect(main).toContain("virtual:pwa-register");
    expect(main).toContain("registerSW");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/pwa-config.test.ts`  
Expected: FAIL (index.html, vite-env.d.ts and main.tsx not updated yet).

- [ ] **Step 3: Update `src/vite-env.d.ts`**

Update `src/vite-env.d.ts`:
```typescript
/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />
```

- [ ] **Step 4: Update `src/main.tsx`**

Update `src/main.tsx`:
```tsx
import { render } from 'preact';
import { App } from './App';
import './styles/theme.css';
import './styles/app.css';
import { registerSW } from 'virtual:pwa-register';

registerSW({
  immediate: true
});

const container = document.getElementById('app');
if (container) {
  render(<App />, container);
}
```

- [ ] **Step 5: Update `index.html`**

Update `index.html` head section:
```html
<!DOCTYPE html>
<html lang="fr" dir="ltr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <title>Nusuk Photo — Recadrage photo Hajj & Omra</title>
    <meta name="description" content="Recadrage et mise en conformité de photos d'identité pour le portail Hajj Nusuk (480x640, fond blanc, < 1 Mo)." />
    <meta name="theme-color" content="#006C35" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <meta name="apple-mobile-web-app-title" content="Nusuk Photo" />
    <link rel="apple-touch-icon" href="/icons/apple-touch-icon-180x180.png" />
    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🕋</text></svg>" />
    <script src="/anti-fouc.js"></script>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 6: Update `vite.config.ts` with `VitePWA`**

In `vite.config.ts`, import `VitePWA` and add it to plugins:
```typescript
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
  plugins: [
    servePublicOrtPlugin(),
    preact(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'anti-fouc.js',
        'locales/*.json',
        'icons/*.png',
        'models/**/*.{json,onnx}',
        'vendor/ort/*.{wasm,mjs,js}'
      ],
      manifest: {
        id: '/',
        name: 'Nusuk Photo — Recadrage photo Hajj & Omra',
        short_name: 'Nusuk Photo',
        description: "Recadrage et mise en conformité de photos d'identité pour le portail Hajj Nusuk (480x640, fond blanc, < 1 Mo).",
        start_url: '/',
        scope: '/',
        display: 'standalone',
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
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json,wasm,onnx}'],
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
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npx vitest run tests/pwa-config.test.ts`  
Expected: PASS with 3 tests passing.

- [ ] **Step 8: Commit**

```bash
git add vite.config.ts index.html src/vite-env.d.ts src/main.tsx tests/pwa-config.test.ts
git commit -m "feat(pwa): configure VitePWA with Workbox offline cache and manifest"
```

---

### Task 4: Production Build Verification & Full Test Suite

**Files:**
- Create: `tests/pwa-build.test.ts`
- Test: All unit and integration test suites

**Interfaces:**
- Consumes: `npm run build` output in `dist/`
- Produces: Verified `dist/sw.js`, `dist/manifest.webmanifest`, and working offline bundle

- [ ] **Step 1: Write integration test for build artifacts**

Create `tests/pwa-build.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('PWA Build Artifacts', () => {
  it('generates dist/sw.js and dist/manifest.webmanifest upon build', () => {
    const swPath = path.resolve(process.cwd(), 'dist/sw.js');
    const manifestPath = path.resolve(process.cwd(), 'dist/manifest.webmanifest');

    expect(fs.existsSync(swPath), 'dist/sw.js must exist after build').toBe(true);
    expect(fs.existsSync(manifestPath), 'dist/manifest.webmanifest must exist after build').toBe(true);

    const manifestContent = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    expect(manifestContent.name).toBe('Nusuk Photo — Recadrage photo Hajj & Omra');
    expect(manifestContent.display).toBe('standalone');
    expect(manifestContent.theme_color).toBe('#006C35');
    expect(manifestContent.icons.length).toBeGreaterThanOrEqual(4);
  });
});
```

- [ ] **Step 2: Run production build**

Run: `npm run build`  
Expected: `tsc` succeeds without error, `vite build` finishes and outputs PWA assets in `dist/` including `dist/sw.js` and `dist/manifest.webmanifest`.

- [ ] **Step 3: Run the build artifact verification test**

Run: `npx vitest run tests/pwa-build.test.ts`  
Expected: PASS with 1 test passing.

- [ ] **Step 4: Run full test suite to guarantee zero regression**

Run: `npm test`  
Expected: All 154+ tests pass (151 existing + 3 new test suites).

- [ ] **Step 5: Commit**

```bash
git add tests/pwa-build.test.ts
git commit -m "test(pwa): add integration test for PWA build outputs and manifest"
```
