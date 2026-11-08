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

  it('renders only the 2 Nusuk presets when brand is nusuk', () => {
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
    expect(buttons.length).toBe(2);
    expect(buttons[0]?.textContent).toContain('Nusuk Identité');
    expect(buttons[1]?.textContent).toContain('Nusuk Document');
  });

  it('renders generic presets (Passeport, 2x2 in, Identité, Document) when brand is portrait', () => {
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
    expect(buttons.length).toBe(4);
    expect(buttons[0]?.textContent).toContain('35×45 mm (Passeport)');
    expect(buttons[1]?.textContent).toContain('51×51 mm (2×2 in)');
    expect(buttons[2]?.textContent).toContain('480×640 (Identité)');
    expect(buttons[3]?.textContent).toContain('1100×825 (Document)');

    // Should NOT contain the word Nusuk
    const allText = Array.from(buttons).map(b => b.textContent).join(' ');
    expect(allText).not.toContain('Nusuk');
  });

  it('renders generic PNG warning when brand is portrait', () => {
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
