import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('PWA Assets', () => {
  const iconTargets = [
    // Nusuk brand icons
    { path: 'public/icons/pwa-64x64.png', size: 64 },
    { path: 'public/icons/pwa-192x192.png', size: 192 },
    { path: 'public/icons/pwa-512x512.png', size: 512 },
    { path: 'public/icons/maskable-icon-512x512.png', size: 512 },
    { path: 'public/icons/apple-touch-icon-180x180.png', size: 180 },

    // Portrait (Azure) brand icons
    { path: 'public/icons/portrait-pwa-64x64.png', size: 64 },
    { path: 'public/icons/portrait-pwa-192x192.png', size: 192 },
    { path: 'public/icons/portrait-pwa-512x512.png', size: 512 },
    { path: 'public/icons/portrait-maskable-icon-512x512.png', size: 512 },
    { path: 'public/icons/portrait-apple-touch-icon-180x180.png', size: 180 }
  ];

  it('contains all required PWA icons with non-zero file sizes', () => {
    for (const icon of iconTargets) {
      const fullPath = path.resolve(process.cwd(), icon.path);
      expect(fs.existsSync(fullPath), `Icon ${icon.path} should exist`).toBe(true);
      const stat = fs.statSync(fullPath);
      expect(stat.size).toBeGreaterThan(100);
    }
  });

  it('validates PNG header signature for generated icons', () => {
    for (const icon of iconTargets) {
      const fullPath = path.resolve(process.cwd(), icon.path);
      const buffer = fs.readFileSync(fullPath);
      // PNG magic bytes: 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A
      expect(buffer[0]).toBe(0x89);
      expect(buffer[1]).toBe(0x50);
      expect(buffer[2]).toBe(0x4e);
      expect(buffer[3]).toBe(0x47);
    }
  });

  it('validates IHDR width and height dimensions match target sizes', () => {
    for (const icon of iconTargets) {
      const fullPath = path.resolve(process.cwd(), icon.path);
      const buffer = fs.readFileSync(fullPath);
      const width = buffer.readUInt32BE(16);
      const height = buffer.readUInt32BE(20);
      expect(width, `${icon.path} width must be ${icon.size}`).toBe(icon.size);
      expect(height, `${icon.path} height must be ${icon.size}`).toBe(icon.size);
    }
  });
});
