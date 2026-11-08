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
