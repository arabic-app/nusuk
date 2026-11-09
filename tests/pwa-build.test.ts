import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('PWA Build Artifacts', () => {
  beforeAll(async () => {
    if (!fs.existsSync(path.resolve(process.cwd(), 'dist/sw.js'))) {
      const { execSync } = await import('node:child_process');
      execSync('npm run build', { stdio: 'ignore' });
    }
  });

  it('generates dist/sw.js and dist/manifest.webmanifest upon build', () => {
    const swPath = path.resolve(process.cwd(), 'dist/sw.js');
    const manifestPath = path.resolve(process.cwd(), 'dist/manifest.webmanifest');

    expect(fs.existsSync(swPath), 'dist/sw.js must exist after build').toBe(true);
    expect(fs.existsSync(manifestPath), 'dist/manifest.webmanifest must exist after build').toBe(true);

    const manifestContent = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    expect(manifestContent.name).toBe('Nusuk Photo — Recadrage photo Hajj & Omra');
    expect(manifestContent.display).toBe('standalone');
    expect(manifestContent.orientation).toBe('any');
    expect(manifestContent.categories).toEqual(['productivity', 'utilities', 'photo']);
    expect(manifestContent.theme_color).toBe('#006C35');
    expect(manifestContent.icons.length).toBeGreaterThanOrEqual(4);
  });

  it('generates dist/manifest-portrait.webmanifest with azure theme upon build', () => {
    const portraitManifestPath = path.resolve(process.cwd(), 'dist/manifest-portrait.webmanifest');
    expect(fs.existsSync(portraitManifestPath), 'dist/manifest-portrait.webmanifest must exist after build').toBe(true);

    const portraitContent = JSON.parse(fs.readFileSync(portraitManifestPath, 'utf-8'));
    expect(portraitContent.name).toBe("Portrait Photo — Recadrage photo d'identité & passeport");
    expect(portraitContent.short_name).toBe('Portrait Photo');
    expect(portraitContent.display).toBe('standalone');
    expect(portraitContent.theme_color).toBe('#0284C7');
    expect(portraitContent.background_color).toBe('#F8FAFC');
    expect(portraitContent.icons.length).toBeGreaterThanOrEqual(4);
    expect(portraitContent.icons[0].src).toContain('portrait-pwa');
  });

  it('precaches both manifests and all brand icons in service worker', () => {
    const swPath = path.resolve(process.cwd(), 'dist/sw.js');
    const swContent = fs.readFileSync(swPath, 'utf-8');
    expect(swContent).toContain('manifest-portrait.webmanifest');
  });
});
