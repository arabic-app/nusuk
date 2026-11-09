// tests/brand.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { h, render } from 'preact';
import { detectBrand, getBrand, setBrand, initBrand } from '../src/utils/brand';
import { Header } from '../src/components/Header';
import { SettingsPanel } from '../src/components/SettingsPanel';
import { PRESETS, createDefaultSheetConfig } from '../src/utils/dimensions';
import { getExportFilename, MAX_NUSUK_BYTES } from '../src/utils/exportBridge';
import { setLocale } from '../src/utils/i18n';
import { setTheme } from '../src/utils/theme';

describe('Brand detection engine', () => {
  it('detects nusuk only when url/hostname contains nusuk', () => {
    expect(detectBrand('nusuk-tools.vercel.app')).toBe('nusuk');
    expect(detectBrand('subdomain.nusuk.sa')).toBe('nusuk');
    expect(detectBrand('nusuk-preview.vercel.app')).toBe('nusuk');
  });

  it('detects portrait (azure brand) when not opened via nusuk', () => {
    expect(detectBrand('portrait-tools.vercel.app')).toBe('portrait');
    expect(detectBrand('example.com')).toBe('portrait');
    expect(detectBrand('idphoto-tools.com')).toBe('portrait');
  });

  it('supports URL query parameter overrides (?brand=nusuk / ?brand=portrait)', () => {
    const originalLocation = window.location;
    delete (window as any).location;

    window.location = {
      ...originalLocation,
      hostname: 'portrait-tools.vercel.app',
      search: '?brand=nusuk'
    } as any;
    expect(detectBrand()).toBe('nusuk');

    window.location = {
      ...originalLocation,
      hostname: 'nusuk-tools.vercel.app',
      search: '?brand=portrait'
    } as any;
    expect(detectBrand()).toBe('portrait');

    window.location = originalLocation;
  });

  it('sets data-brand attribute on documentElement (nusuk vs azure)', () => {
    setBrand('nusuk');
    expect(document.documentElement.getAttribute('data-brand')).toBe('nusuk');

    setBrand('portrait');
    expect(document.documentElement.getAttribute('data-brand')).toBe('azure');
  });

  it('updates PWA meta tags and manifest links when switching brands', () => {
    // Setup initial DOM elements
    document.head.innerHTML = `
      <meta name="theme-color" content="#006C35" />
      <meta name="description" content="Nusuk description" />
      <meta name="apple-mobile-web-app-title" content="Nusuk Photo" />
      <link rel="apple-touch-icon" href="/icons/apple-touch-icon-180x180.png" />
      <link rel="icon" href="data:image/svg+xml,kaaba" />
      <link rel="manifest" href="/manifest.webmanifest" />
    `;

    setBrand('portrait');
    expect(document.title).toContain('Portrait Photo');
    expect(document.querySelector('meta[name="apple-mobile-web-app-title"]')?.getAttribute('content')).toBe('Portrait Photo');
    expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toContain('passeports');
    expect(document.querySelector('link[rel="apple-touch-icon"]')?.getAttribute('href')).toBe('/icons/portrait-apple-touch-icon-180x180.png');
    expect(document.querySelector('link[rel="manifest"]')?.getAttribute('href')).toBe('/manifest-portrait.webmanifest');

    setBrand('nusuk');
    expect(document.title).toContain('Nusuk Photo');
    expect(document.querySelector('meta[name="apple-mobile-web-app-title"]')?.getAttribute('content')).toBe('Nusuk Photo');
    expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toContain('Nusuk');
    expect(document.querySelector('link[rel="apple-touch-icon"]')?.getAttribute('href')).toBe('/icons/apple-touch-icon-180x180.png');
    expect(document.querySelector('link[rel="manifest"]')?.getAttribute('href')).toBe('/manifest.webmanifest');
  });
});

describe('Header component brand customization', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    setLocale('fr');
    setTheme('light');
  });

  afterEach(() => {
    render(null, container);
    container.remove();
  });

  it('renders Nusuk icon (Kaaba) and Nusuk title/tagline for nusuk brand', () => {
    setBrand('nusuk');
    render(h(Header, {}), container);

    const title = container.querySelector('.brand-title');
    const tagline = container.querySelector('.brand-tagline');
    expect(title?.textContent).toBe('Nusuk Photo');
    expect(tagline?.textContent).toContain('Hajj & Omra');

    // Logo icon contains kaaba paths
    const logoSvg = container.querySelector('.brand-logo svg');
    expect(logoSvg).not.toBeNull();
  });

  it('renders Portrait icon and generic title/tagline for portrait brand', () => {
    setBrand('portrait');
    render(h(Header, {}), container);

    const title = container.querySelector('.brand-title');
    const tagline = container.querySelector('.brand-tagline');
    expect(title?.textContent).toBe('Portrait Photo');
    expect(tagline?.textContent).toContain("photo d'identité & passeport");
    expect(tagline?.textContent).not.toContain('Hajj');
  });
});

describe('SettingsPanel brand customization', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    setLocale('fr');
  });

  afterEach(() => {
    render(null, container);
    container.remove();
  });

  it('renders all 4 Nusuk presets in correct order when brand is nusuk', () => {
    render(
      h(SettingsPanel, {
        dimension: PRESETS.nusuk,
        onDimensionChange: vi.fn(),
        exportConfig: { format: 'image/jpeg', quality: 0.95, maxBytes: MAX_NUSUK_BYTES },
        onExportConfigChange: vi.fn(),
        encodedBytes: 400_000,
        bgRemovalActive: false,
        bgLoading: false,
        featherRadius: 0,
        onToggleBgRemoval: vi.fn(),
        onFeatherChange: vi.fn(),
        sheetConfig: createDefaultSheetConfig(),
        onSheetConfigChange: vi.fn(),
        brand: 'nusuk'
      }),
      container
    );

    const buttons = container.querySelectorAll<HTMLButtonElement>('.preset-buttons button');
    expect(buttons.length).toBe(4);
    expect(buttons[0]?.textContent).toContain('480 x 640 (Nusuk Photo)');
    expect(buttons[0]?.title).toBe("Photo d'identité sur Nusuk (480×640)");

    expect(buttons[1]?.textContent).toContain('1100 x 825 (Nusuk Passeport)');
    expect(buttons[1]?.title).toBe('Passeport sur Nusuk (1100×825)');

    expect(buttons[2]?.textContent).toContain('630 x 400 (Nusuk Résident)');
    expect(buttons[2]?.title).toBe('Carte de résident sur Nusuk (630×400)');

    expect(buttons[3]?.textContent).toContain('825 x 1100 (Nusuk Document)');
    expect(buttons[3]?.title).toBe('Document sur Nusuk (825×1100)');
  });

  it('renders generic presets (Passeport, 2x2 in, Canada) and no Document preset when brand is portrait', () => {
    render(
      h(SettingsPanel, {
        dimension: PRESETS.passport,
        onDimensionChange: vi.fn(),
        exportConfig: { format: 'image/jpeg', quality: 0.95, maxBytes: MAX_NUSUK_BYTES },
        onExportConfigChange: vi.fn(),
        encodedBytes: 400_000,
        bgRemovalActive: false,
        bgLoading: false,
        featherRadius: 0,
        onToggleBgRemoval: vi.fn(),
        onFeatherChange: vi.fn(),
        sheetConfig: createDefaultSheetConfig(),
        onSheetConfigChange: vi.fn(),
        brand: 'portrait'
      }),
      container
    );

    const buttons = container.querySelectorAll<HTMLButtonElement>('.preset-buttons button');
    expect(buttons.length).toBe(3);
    expect(buttons[0]?.textContent).toContain('35×45 mm (Passeport / CNI)');
    expect(buttons[1]?.textContent).toContain('51×51 mm (Visa US / 2×2 in)');
    expect(buttons[2]?.textContent).toContain('50×70 mm (Passeport Canada)');

    // Should NOT contain Nusuk or Document
    const allText = Array.from(buttons).map(b => b.textContent).join(' ');
    expect(allText).not.toContain('Nusuk');
    expect(allText).not.toContain('480');
    expect(allText).not.toContain('1100');
    expect(allText).not.toContain('Document');
  });

  it('renders generic PNG warning when brand is portrait and limit exceeded', () => {
    render(
      h(SettingsPanel, {
        dimension: PRESETS.passport,
        onDimensionChange: vi.fn(),
        exportConfig: { format: 'image/png', quality: 1, maxBytes: MAX_NUSUK_BYTES },
        onExportConfigChange: vi.fn(),
        encodedBytes: 1_200_000,
        bgRemovalActive: false,
        bgLoading: false,
        featherRadius: 0,
        onToggleBgRemoval: vi.fn(),
        onFeatherChange: vi.fn(),
        sheetConfig: createDefaultSheetConfig(),
        onSheetConfigChange: vi.fn(),
        brand: 'portrait'
      }),
      container
    );

    const warning = container.querySelector('.warning-banner');
    expect(warning?.textContent).toContain('trop volumineux');
    expect(warning?.textContent).not.toContain('Nusuk');
  });

  it('does NOT render PNG warning for 1.2MB image when using portrait brand limit (10MB)', () => {
    render(
      h(SettingsPanel, {
        dimension: PRESETS.passport,
        onDimensionChange: vi.fn(),
        exportConfig: { format: 'image/png', quality: 1, maxBytes: 10_000_000 },
        onExportConfigChange: vi.fn(),
        encodedBytes: 1_200_000,
        bgRemovalActive: false,
        bgLoading: false,
        featherRadius: 0,
        onToggleBgRemoval: vi.fn(),
        onFeatherChange: vi.fn(),
        sheetConfig: createDefaultSheetConfig(),
        onSheetConfigChange: vi.fn(),
        brand: 'portrait'
      }),
      container
    );

    const warning = container.querySelector('.warning-banner');
    expect(warning).toBeNull();
  });
});

describe('Export filename generator with brand', () => {
  it('generates photo-nusuk filenames for nusuk brand', () => {
    expect(getExportFilename(640, 480, 'image/jpeg', undefined, 'nusuk')).toBe('photo-nusuk-640x480.jpg');
    const sheetCfg = { ...createDefaultSheetConfig(), enabled: true, preset: '10x15' as const };
    expect(getExportFilename(1772, 1181, 'image/jpeg', sheetCfg, 'nusuk')).toBe('planche-photo-nusuk-10x15.jpg');
  });

  it('generates photo-portrait filenames for portrait brand', () => {
    expect(getExportFilename(640, 480, 'image/jpeg', undefined, 'portrait')).toBe('photo-portrait-640x480.jpg');
    const sheetCfg = { ...createDefaultSheetConfig(), enabled: true, preset: '10x15' as const };
    expect(getExportFilename(1772, 1181, 'image/jpeg', sheetCfg, 'portrait')).toBe('planche-photo-portrait-10x15.jpg');
  });
});
