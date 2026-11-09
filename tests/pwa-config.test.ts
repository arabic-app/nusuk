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

  it('adapts PWA manifest and apple touch icons in anti-fouc.js for brand differentiation', () => {
    const antiFouc = fs.readFileSync(path.resolve(process.cwd(), 'public/anti-fouc.js'), 'utf-8');
    expect(antiFouc).toContain('manifest-portrait.webmanifest');
    expect(antiFouc).toContain('portrait-apple-touch-icon-180x180.png');
    expect(antiFouc).toContain('apple-mobile-web-app-title');
    expect(antiFouc).toContain('Portrait Photo');
  });
});
