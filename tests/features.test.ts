// tests/features.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { h, render } from 'preact';
import { isPhotoSheetEnabled } from '../src/utils/features';
import { SettingsPanel } from '../src/components/SettingsPanel';
import { PRESETS, createDefaultSheetConfig } from '../src/utils/dimensions';
import { MAX_NUSUK_BYTES } from '../src/utils/exportBridge';

describe('features / isPhotoSheetEnabled', () => {
  const originalLocation = window.location;

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
      configurable: true
    });
  });

  it('enables photo sheet for portrait-tools.vercel.app in production', () => {
    expect(isPhotoSheetEnabled('portrait-tools.vercel.app')).toBe(true);
    expect(isPhotoSheetEnabled('portrait-tools-git-main-user.vercel.app')).toBe(true);
  });

  it('disables photo sheet for nusuk-tools.vercel.app in production', () => {
    expect(isPhotoSheetEnabled('nusuk-tools.vercel.app')).toBe(false);
    expect(isPhotoSheetEnabled('nusuk-tools-preview.vercel.app')).toBe(false);
  });

  it('disables photo sheet for other unrelated production domains', () => {
    expect(isPhotoSheetEnabled('example.com')).toBe(false);
  });

  it('supports URL query parameter overrides (?sheet=true / ?sheet=false)', () => {
    delete (window as any).location;
    window.location = {
      ...originalLocation,
      hostname: 'nusuk-tools.vercel.app',
      search: '?sheet=true'
    } as any;

    expect(isPhotoSheetEnabled()).toBe(true);

    window.location = {
      ...originalLocation,
      hostname: 'portrait-tools.vercel.app',
      search: '?sheet=false'
    } as any;

    expect(isPhotoSheetEnabled()).toBe(false);
  });
});

describe('SettingsPanel photo sheet visibility toggle', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    render(null, container);
    container.remove();
  });

  it('hides palette-card when showPhotoSheet is false', () => {
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
        onOpenSheetPreview: vi.fn(),
        showPhotoSheet: false
      }),
      container
    );

    const paletteCard = container.querySelector('.palette-card');
    expect(paletteCard).toBeNull();
  });

  it('shows palette-card when showPhotoSheet is true', () => {
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
        onOpenSheetPreview: vi.fn(),
        showPhotoSheet: true
      }),
      container
    );

    const paletteCard = container.querySelector('.palette-card');
    expect(paletteCard).not.toBeNull();
  });
});
