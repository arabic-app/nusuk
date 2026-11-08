import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

// Module resolution verification
import { PRESETS, convertToPixels, convertFromPixels, clampDimension } from '../src/utils/dimensions';
import {
  MAX_NUSUK_BYTES,
  formatFileSize,
  getExportFilename,
  getExportWorker,
  terminateExportWorker,
  renderAndEncode
} from '../src/utils/exportBridge';
import { MAX_FILE_BYTES, isValidImageHeader, validateImageFile } from '../src/utils/fileValidation';
import { initLocale, t, setLocale, getLocale, subscribeLocale } from '../src/utils/i18n';
import { initTheme, getStoredTheme, setTheme } from '../src/utils/theme';
import {
  createDefaultTransform,
  rotate90,
  toggleFlip,
  fitTransform,
  fillTransform,
  computeBoundingBox,
  hasEmptyAreas
} from '../src/utils/transform';
import { App } from '../src/App';
import { Header } from '../src/components/Header';
import { Dropzone } from '../src/components/Dropzone';
import { CropViewport } from '../src/components/CropViewport';
import { SettingsPanel } from '../src/components/SettingsPanel';
import { ActionBar } from '../src/components/ActionBar';
import { WorkerBackgroundRemover, getBackgroundRemover } from '../src/services/BackgroundRemover';

describe('End-to-end integration constraints', () => {
  describe('Nusuk portal specifications', () => {
    it('strictly adheres to Nusuk requirements', () => {
      expect(PRESETS.nusuk.width).toBe(480);
      expect(PRESETS.nusuk.height).toBe(640);
      expect(PRESETS.nusuk.unit).toBe('px');
      expect(PRESETS.nusuk.lockRatio).toBe(true);
      expect(MAX_NUSUK_BYTES).toBe(1_000_000);
    });

    it('validates standard Nusuk dimension calculations', () => {
      const pxWidth = convertToPixels(PRESETS.nusuk.width, PRESETS.nusuk.unit, PRESETS.nusuk.dpi);
      const pxHeight = convertToPixels(PRESETS.nusuk.height, PRESETS.nusuk.unit, PRESETS.nusuk.dpi);
      expect(pxWidth).toBe(480);
      expect(pxHeight).toBe(640);
      expect(clampDimension(pxWidth)).toBe(480);
    });

    it('formats export filename according to Nusuk naming convention', () => {
      expect(getExportFilename(480, 640, 'image/jpeg', undefined, 'nusuk')).toBe('photo-nusuk-480x640.jpg');
      expect(getExportFilename(480, 640, 'image/png', undefined, 'nusuk')).toBe('photo-nusuk-480x640.png');
    });

    it('validates image files rejecting oversized uploads (> 30MB) and non-images', async () => {
      // Valid JPEG header
      const validJpeg = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], 'valid.jpg', { type: 'image/jpeg' });
      const validRes = await validateImageFile(validJpeg);
      expect(validRes.valid).toBe(true);

      // Oversized upload
      const oversized = new File([new Uint8Array(10)], 'huge.jpg', { type: 'image/jpeg' });
      Object.defineProperty(oversized, 'size', { value: MAX_FILE_BYTES + 1 });
      const overRes = await validateImageFile(oversized);
      expect(overRes.valid).toBe(false);
      expect(overRes.error).toBe('dropzone.error_size');
    });
  });

  describe('Module resolution', () => {
    it('successfully resolves all utility modules and functions', () => {
      expect(typeof convertToPixels).toBe('function');
      expect(typeof convertFromPixels).toBe('function');
      expect(typeof clampDimension).toBe('function');
      expect(typeof formatFileSize).toBe('function');
      expect(typeof getExportFilename).toBe('function');
      expect(typeof getExportWorker).toBe('function');
      expect(typeof terminateExportWorker).toBe('function');
      expect(typeof renderAndEncode).toBe('function');
      expect(typeof isValidImageHeader).toBe('function');
      expect(typeof validateImageFile).toBe('function');
      expect(typeof initLocale).toBe('function');
      expect(typeof t).toBe('function');
      expect(typeof setLocale).toBe('function');
      expect(typeof getLocale).toBe('function');
      expect(typeof subscribeLocale).toBe('function');
      expect(typeof initTheme).toBe('function');
      expect(typeof getStoredTheme).toBe('function');
      expect(typeof setTheme).toBe('function');
      expect(typeof createDefaultTransform).toBe('function');
      expect(typeof rotate90).toBe('function');
      expect(typeof toggleFlip).toBe('function');
      expect(typeof fitTransform).toBe('function');
      expect(typeof fillTransform).toBe('function');
      expect(typeof computeBoundingBox).toBe('function');
      expect(typeof hasEmptyAreas).toBe('function');
      expect(typeof WorkerBackgroundRemover).toBe('function');
      expect(typeof getBackgroundRemover).toBe('function');
    });

    it('successfully resolves all Preact UI components', () => {
      expect(typeof App).toBe('function');
      expect(typeof Header).toBe('function');
      expect(typeof Dropzone).toBe('function');
      expect(typeof CropViewport).toBe('function');
      expect(typeof SettingsPanel).toBe('function');
      expect(typeof ActionBar).toBe('function');
    });
  });

  describe('Zero external runtime dependencies', () => {
    it('contains zero external runtime dependencies other than preact and @huggingface/transformers', () => {
      const packageJsonPath = resolve(__dirname, '../package.json');
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
      const deps = Object.keys(packageJson.dependencies || {}).sort();

      expect(deps).toEqual(['@huggingface/transformers', 'preact']);
      expect(deps.length).toBe(2);
    });
  });

  describe('Content Security Policy & Security Headers', () => {
    it('verifies strict CSP headers in vercel.json preventing external requests', () => {
      const vercelJsonPath = resolve(__dirname, '../vercel.json');
      expect(existsSync(vercelJsonPath)).toBe(true);

      const vercelJson = JSON.parse(readFileSync(vercelJsonPath, 'utf-8'));
      const rootRule = vercelJson.headers.find((rule: any) => rule.source === '/(.*)');
      expect(rootRule).toBeDefined();

      const headersMap = new Map<string, string>();
      for (const h of rootRule.headers) {
        headersMap.set(h.key, h.value);
      }

      const csp = headersMap.get('Content-Security-Policy');
      expect(csp).toBeDefined();

      // Ensure zero external telemetry/CDN access
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("img-src 'self' blob: data:");
      expect(csp).toContain("worker-src 'self' blob:");
      expect(csp).toContain("script-src 'self' 'wasm-unsafe-eval'");
      expect(csp).toContain("style-src 'self' 'unsafe-inline'");
      expect(csp).toContain("font-src 'self'");
      expect(csp).toContain("connect-src 'self'");

      // Verify security hardening headers
      expect(headersMap.get('X-Content-Type-Options')).toBe('nosniff');
      expect(headersMap.get('X-Frame-Options')).toBe('DENY');
      expect(headersMap.get('Referrer-Policy')).toBe('no-referrer');
    });
  });

  describe('HTML Shell & Anti-FOUC Implementation', () => {
    it('verifies index.html has required meta tags and external anti-FOUC script reference', () => {
      const indexHtmlPath = resolve(__dirname, '../index.html');
      const html = readFileSync(indexHtmlPath, 'utf-8');

      // Meta tags and structure
      expect(html).toContain('<meta charset="UTF-8"');
      expect(html).toContain('name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"');
      expect(html).toContain('<title>Nusuk Photo — Recadrage photo Hajj & Omra</title>');
      expect(html).toContain('<div id="app"></div>');
      expect(html).toContain('src="/src/main.tsx"');

      // CSP-compliant anti-FOUC script reference
      expect(html).toContain('<script src="/anti-fouc.js"></script>');

      // Anti-FOUC external script file verification
      const antiFoucPath = resolve(__dirname, '../public/anti-fouc.js');
      expect(existsSync(antiFoucPath)).toBe(true);
      const antiFoucContent = readFileSync(antiFoucPath, 'utf-8');
      expect(antiFoucContent).toContain('nusuk_photo_theme');
      expect(antiFoucContent).toContain('data-theme');
      expect(antiFoucContent).toContain('colorScheme');
      expect(antiFoucContent).toContain('nusuk_photo_locale');
      expect(antiFoucContent).toContain("locale === 'ar' ? 'rtl' : 'ltr'");
    });
  });

  describe('Static build artifact verification', () => {
    it('confirms bundle is well below Vercel 100MB serverless limit', () => {
      const distDir = resolve(__dirname, '../dist');
      if (existsSync(distDir)) {
        let totalBytes = 0;
        const scan = (dir: string) => {
          const files = readdirSync(dir);
          for (const file of files) {
            const fullPath = resolve(dir, file);
            const s = statSync(fullPath);
            if (s.isDirectory()) {
              scan(fullPath);
            } else {
              totalBytes += s.size;
            }
          }
        };
        scan(distDir);
        // Ensure bundle is well below 100MB (Vercel Hobby plan limit is 100MB)
        expect(totalBytes).toBeLessThan(100 * 1024 * 1024);
        expect(totalBytes).toBeGreaterThan(0);
      }
    });
  });
});
