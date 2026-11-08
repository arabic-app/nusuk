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
