// tests/app.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { h, render } from 'preact';
import { Header } from '../src/components/Header';
import { ActionBar } from '../src/components/ActionBar';
import { SettingsPanel } from '../src/components/SettingsPanel';
import { SheetPreviewModal } from '../src/components/SheetPreviewModal';
import { App } from '../src/App';
import { getExportFilename, MAX_NUSUK_BYTES } from '../src/utils/exportBridge';
import * as exportBridge from '../src/utils/exportBridge';
import { PRESETS, createDefaultSheetConfig } from '../src/utils/dimensions';
import { createDefaultTransform } from '../src/utils/transform';
import { setLocale, getLocale, t } from '../src/utils/i18n';
import { setTheme, getStoredTheme } from '../src/utils/theme';

if (!globalThis.localStorage || typeof globalThis.localStorage.clear !== 'function') {
  const store = new Map<string, string>();
  const mockStorage: Storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    }
  };
  Object.defineProperty(globalThis, 'localStorage', {
    value: mockStorage,
    writable: true,
    configurable: true
  });
  if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true
    });
  }
}

describe('App filename generator', () => {
  it('formats Nusuk 640x480 filename accurately', () => {
    expect(getExportFilename(640, 480, 'image/jpeg')).toBe('photo-nusuk-640x480.jpg');
    expect(getExportFilename(413, 531, 'image/png')).toBe('photo-nusuk-413x531.png');
    expect(getExportFilename(600, 600, 'image/jpeg')).toBe('photo-nusuk-600x600.jpg');

    // Sheet filename
    const sheetCfg = {
      enabled: true,
      preset: '10x15' as const,
      width: 15,
      height: 10,
      unit: 'cm' as const,
      dpi: 300,
      orientation: 'auto' as const,
      cutGuides: true,
      spacingMm: 2,
      marginMm: 3
    };
    expect(getExportFilename(1772, 1181, 'image/jpeg', sheetCfg)).toBe('planche-photo-nusuk-10x15.jpg');
  });
});

describe('Header component', () => {
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

  it('renders brand title and tagline', () => {
    render(h(Header, {}), container);
    const title = container.querySelector('.brand-title');
    const tagline = container.querySelector('.brand-tagline');
    expect(title?.textContent).toBe('Nusuk Photo');
    expect(tagline?.textContent).toContain('Recadrage');
  });

  it('supports compact dropdown language selector switching between FR, AR, EN', async () => {
    setLocale('fr');
    render(h(Header, {}), container);
    
    // Check compact trigger button
    const trigger = container.querySelector<HTMLButtonElement>('.lang-dropdown-trigger');
    expect(trigger).not.toBeNull();
    expect(trigger?.textContent).toContain('FR');
    expect(trigger?.getAttribute('aria-expanded')).toBe('false');

    // Dropdown menu is not open yet
    expect(container.querySelector('.lang-dropdown-menu')).toBeNull();

    // Click trigger to open dropdown
    trigger?.click();
    await new Promise(r => setTimeout(r, 10));

    expect(trigger?.getAttribute('aria-expanded')).toBe('true');
    const menu = container.querySelector('.lang-dropdown-menu');
    expect(menu).not.toBeNull();

    const items = container.querySelectorAll<HTMLButtonElement>('.lang-dropdown-item');
    expect(items.length).toBe(3);

    // Switch to EN
    const enItem = Array.from(items).find(b => b.textContent?.includes('EN') || b.textContent?.includes('English'));
    expect(enItem).toBeDefined();
    enItem?.click();
    await new Promise(r => setTimeout(r, 10));

    expect(getLocale()).toBe('en');
    expect(container.querySelector('.lang-dropdown-menu')).toBeNull();
    const updatedTriggerEn = container.querySelector<HTMLButtonElement>('.lang-dropdown-trigger');
    expect(updatedTriggerEn?.textContent).toContain('EN');

    // Open dropdown again and switch to AR
    updatedTriggerEn?.click();
    await new Promise(r => setTimeout(r, 10));
    const arItem = Array.from(container.querySelectorAll<HTMLButtonElement>('.lang-dropdown-item')).find(b => b.textContent?.includes('العربية'));
    expect(arItem).toBeDefined();
    arItem?.click();
    await new Promise(r => setTimeout(r, 10));

    expect(getLocale()).toBe('ar');
    expect(container.querySelector('.lang-dropdown-menu')).toBeNull();
    const updatedTriggerAr = container.querySelector<HTMLButtonElement>('.lang-dropdown-trigger');
    expect(updatedTriggerAr?.textContent).toContain('AR');

    // Test closing via Escape key
    updatedTriggerAr?.click();
    await new Promise(r => setTimeout(r, 10));
    expect(container.querySelector('.lang-dropdown-menu')).not.toBeNull();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await new Promise(r => setTimeout(r, 10));
    expect(container.querySelector('.lang-dropdown-menu')).toBeNull();
  });

  it('toggles theme between light and dark', async () => {
    render(h(Header, {}), container);
    const themeBtn = container.querySelector<HTMLButtonElement>('.theme-toggle-btn');
    expect(themeBtn).toBeDefined();

    expect(themeBtn?.querySelector('.icon-moon')).not.toBeNull();

    themeBtn?.click();
    await new Promise(r => setTimeout(r, 10));
    const updatedDarkBtn = container.querySelector<HTMLButtonElement>('.theme-toggle-btn');
    expect(updatedDarkBtn?.querySelector('.icon-sun')).not.toBeNull();
    expect(getStoredTheme()).toBe('dark');

    updatedDarkBtn?.click();
    await new Promise(r => setTimeout(r, 10));
    const updatedLightBtn = container.querySelector<HTMLButtonElement>('.theme-toggle-btn');
    expect(updatedLightBtn?.querySelector('.icon-moon')).not.toBeNull();
    expect(getStoredTheme()).toBe('light');
  });
});

describe('ActionBar component', () => {
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

  it('displays crop dimensions correctly', () => {
    render(
      h(ActionBar, {
        cropWidth: 640,
        cropHeight: 480,
        bytes: 500_000,
        onDownload: () => {},
        disabled: false
      }),
      container
    );
    const dim = container.querySelector('.info-dim');
    expect(dim?.textContent).toContain('640 × 480 px');
  });

  it('displays green trichrome gauge when weight < 800 KB', () => {
    render(
      h(ActionBar, {
        cropWidth: 640,
        cropHeight: 480,
        bytes: 650_000,
        onDownload: () => {},
        disabled: false
      }),
      container
    );
    const gaugeFill = container.querySelector<HTMLDivElement>('.weight-gauge-fill');
    expect(gaugeFill?.style.backgroundColor).toBe('var(--gauge-green)');
  });

  it('displays orange trichrome gauge when weight is 800 KB - 1000 KB', () => {
    render(
      h(ActionBar, {
        cropWidth: 640,
        cropHeight: 480,
        bytes: 850_000,
        onDownload: () => {},
        disabled: false
      }),
      container
    );
    const gaugeFill = container.querySelector<HTMLDivElement>('.weight-gauge-fill');
    expect(gaugeFill?.style.backgroundColor).toBe('var(--gauge-orange)');
  });

  it('displays red trichrome gauge when weight > 1000 KB', () => {
    render(
      h(ActionBar, {
        cropWidth: 640,
        cropHeight: 480,
        bytes: 1_200_000,
        onDownload: () => {},
        disabled: false
      }),
      container
    );
    const gaugeFill = container.querySelector<HTMLDivElement>('.weight-gauge-fill');
    expect(gaugeFill?.style.backgroundColor).toBe('var(--gauge-red)');
  });

  it('handles download click and disabled state', () => {
    const onDownload = vi.fn();
    render(
      h(ActionBar, {
        cropWidth: 640,
        cropHeight: 480,
        bytes: 500_000,
        onDownload,
        disabled: true
      }),
      container
    );

    const btn = container.querySelector<HTMLButtonElement>('.download-btn');
    expect(btn?.disabled).toBe(true);

    btn?.click();
    expect(onDownload).not.toHaveBeenCalled();

    render(
      h(ActionBar, {
        cropWidth: 640,
        cropHeight: 480,
        bytes: 500_000,
        onDownload,
        disabled: false
      }),
      container
    );

    const activeBtn = container.querySelector<HTMLButtonElement>('.download-btn');
    expect(activeBtn?.disabled).toBe(false);
    activeBtn?.click();
    expect(onDownload).toHaveBeenCalledTimes(1);
  });
});

describe('SettingsPanel component', () => {
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

  it('supports selecting dimension presets', () => {
    const onDimensionChange = vi.fn();
    render(
      h(SettingsPanel, {
        dimension: PRESETS.nusuk,
        onDimensionChange,
        exportConfig: { format: 'image/jpeg', quality: 0.95, maxBytes: MAX_NUSUK_BYTES },
        onExportConfigChange: vi.fn(),
        encodedBytes: 400_000,
        bgRemovalActive: false,
        bgLoading: false,
        featherRadius: 0,
        onToggleBgRemoval: vi.fn(),
        onFeatherChange: vi.fn()
      }),
      container
    );

    const presetBtns = container.querySelectorAll<HTMLButtonElement>('.preset-buttons button');
    expect(presetBtns.length).toBeGreaterThanOrEqual(2);

    // Click passport preset
    const passportBtn = Array.from(presetBtns).find(b => b.textContent?.includes('35×45'));
    passportBtn?.click();
    expect(onDimensionChange).toHaveBeenCalledWith(PRESETS.passport);
  });

  it('supports custom dimension inputs and lock ratio', () => {
    const onDimensionChange = vi.fn();
    render(
      h(SettingsPanel, {
        dimension: { width: 640, height: 480, unit: 'px', dpi: 300, lockRatio: true },
        onDimensionChange,
        exportConfig: { format: 'image/jpeg', quality: 0.95, maxBytes: MAX_NUSUK_BYTES },
        onExportConfigChange: vi.fn(),
        encodedBytes: 400_000,
        bgRemovalActive: false,
        bgLoading: false,
        featherRadius: 0,
        onToggleBgRemoval: vi.fn(),
        onFeatherChange: vi.fn()
      }),
      container
    );

    const widthInput = container.querySelector<HTMLInputElement>('input[name="dim-width"]');
    expect(widthInput).toBeDefined();
    if (widthInput) {
      widthInput.value = '800';
      widthInput.dispatchEvent(new Event('change', { bubbles: true }));
      expect(onDimensionChange).toHaveBeenCalled();
    }
  });

  it('clamps custom dimensions outside [50, 4000] using clampDimension', () => {
    const onDimensionChange = vi.fn();
    render(
      h(SettingsPanel, {
        dimension: { width: 640, height: 480, unit: 'px', dpi: 300, lockRatio: false },
        onDimensionChange,
        exportConfig: { format: 'image/jpeg', quality: 0.95, maxBytes: MAX_NUSUK_BYTES },
        onExportConfigChange: vi.fn(),
        encodedBytes: 400_000,
        bgRemovalActive: false,
        bgLoading: false,
        featherRadius: 0,
        onToggleBgRemoval: vi.fn(),
        onFeatherChange: vi.fn()
      }),
      container
    );

    const widthInput = container.querySelector<HTMLInputElement>('input[name="dim-width"]');
    const heightInput = container.querySelector<HTMLInputElement>('input[name="dim-height"]');

    // Values below MIN_PX (50) clamp to 50
    if (widthInput) {
      widthInput.value = '20';
      widthInput.dispatchEvent(new Event('change', { bubbles: true }));
      expect(onDimensionChange).toHaveBeenLastCalledWith(expect.objectContaining({ width: 50 }));
    }

    // Values above MAX_PX (4000) clamp to 4000
    if (widthInput) {
      widthInput.value = '5000';
      widthInput.dispatchEvent(new Event('change', { bubbles: true }));
      expect(onDimensionChange).toHaveBeenLastCalledWith(expect.objectContaining({ width: 4000 }));
    }

    if (heightInput) {
      heightInput.value = '10';
      heightInput.dispatchEvent(new Event('change', { bubbles: true }));
      expect(onDimensionChange).toHaveBeenLastCalledWith(expect.objectContaining({ height: 50 }));

      heightInput.value = '8000';
      heightInput.dispatchEvent(new Event('change', { bubbles: true }));
      expect(onDimensionChange).toHaveBeenLastCalledWith(expect.objectContaining({ height: 4000 }));
    }
  });

  it('supports AI background toggle, loading state, and feather slider', () => {
    const onToggleBgRemoval = vi.fn();
    const onFeatherChange = vi.fn();

    render(
      h(SettingsPanel, {
        dimension: PRESETS.nusuk,
        onDimensionChange: vi.fn(),
        exportConfig: { format: 'image/jpeg', quality: 0.95, maxBytes: MAX_NUSUK_BYTES },
        onExportConfigChange: vi.fn(),
        encodedBytes: 400_000,
        bgRemovalActive: false,
        bgLoading: false,
        featherRadius: 0.5,
        onToggleBgRemoval,
        onFeatherChange
      }),
      container
    );

    const toggle = container.querySelector<HTMLInputElement>('input[name="bg-remove"]');
    expect(toggle).toBeDefined();
    toggle?.click();
    expect(onToggleBgRemoval).toHaveBeenCalledWith(true);

    // Now render with bgRemovalActive=true
    render(
      h(SettingsPanel, {
        dimension: PRESETS.nusuk,
        onDimensionChange: vi.fn(),
        exportConfig: { format: 'image/jpeg', quality: 0.95, maxBytes: MAX_NUSUK_BYTES },
        onExportConfigChange: vi.fn(),
        encodedBytes: 400_000,
        bgRemovalActive: true,
        bgLoading: false,
        featherRadius: 0.5,
        onToggleBgRemoval,
        onFeatherChange
      }),
      container
    );

    const featherSlider = container.querySelector<HTMLInputElement>('input[name="feather-slider"]');
    expect(featherSlider).toBeDefined();
    if (featherSlider) {
      featherSlider.value = '1.2';
      featherSlider.dispatchEvent(new Event('input', { bubbles: true }));
      expect(onFeatherChange).toHaveBeenCalledWith(1.2);
    }
  });

  it('renders PNG > 1MB warning and allows switching to JPG', () => {
    const onExportConfigChange = vi.fn();
    render(
      h(SettingsPanel, {
        dimension: PRESETS.nusuk,
        onDimensionChange: vi.fn(),
        exportConfig: { format: 'image/png', quality: 1, maxBytes: MAX_NUSUK_BYTES },
        onExportConfigChange,
        encodedBytes: 1_200_000,
        bgRemovalActive: false,
        bgLoading: false,
        featherRadius: 0,
        onToggleBgRemoval: vi.fn(),
        onFeatherChange: vi.fn()
      }),
      container
    );

    const warning = container.querySelector('.warning-banner');
    expect(warning).toBeDefined();
    expect(warning?.textContent).toContain('PNG');

    const switchBtn = warning?.querySelector<HTMLButtonElement>('button');
    switchBtn?.click();
    expect(onExportConfigChange).toHaveBeenCalledWith(expect.objectContaining({ format: 'image/jpeg' }));
  });

  it('renders adjusted quality notification for JPEG', () => {
    render(
      h(SettingsPanel, {
        dimension: PRESETS.nusuk,
        onDimensionChange: vi.fn(),
        exportConfig: { format: 'image/jpeg', quality: 0.95, maxBytes: MAX_NUSUK_BYTES },
        onExportConfigChange: vi.fn(),
        encodedBytes: 950_000,
        adjustedQuality: 0.82,
        bgRemovalActive: false,
        bgLoading: false,
        featherRadius: 0,
        onToggleBgRemoval: vi.fn(),
        onFeatherChange: vi.fn()
      }),
      container
    );

    const qualityInfo = container.querySelector('.quality-info');
    expect(qualityInfo).toBeDefined();
    expect(qualityInfo?.textContent).toContain('0.82');
  });

  it('renders photo sheet (palette) section and handles toggle and configuration', () => {
    const onSheetConfigChange = vi.fn();
    const onOpenSheetPreview = vi.fn();
    const sheetConfig = createDefaultSheetConfig();

    render(
      h(SettingsPanel, {
        dimension: PRESETS.nusuk,
        onDimensionChange: vi.fn(),
        exportConfig: { format: 'image/jpeg', quality: 0.95, maxBytes: MAX_NUSUK_BYTES },
        onExportConfigChange: vi.fn(),
        encodedBytes: 300_000,
        bgRemovalActive: false,
        bgLoading: false,
        featherRadius: 0,
        onToggleBgRemoval: vi.fn(),
        onFeatherChange: vi.fn(),
        sheetConfig,
        onSheetConfigChange,
        onOpenSheetPreview
      }),
      container
    );

    const paletteCard = container.querySelector('.palette-card');
    expect(paletteCard).toBeDefined();
    expect(paletteCard?.textContent).toContain('Planche photo');

    // Toggle enabled checkbox
    const toggleInput = paletteCard?.querySelector<HTMLInputElement>('input[name="palette-enabled"]');
    expect(toggleInput?.checked).toBe(false);
    toggleInput?.click();
    expect(onSheetConfigChange).toHaveBeenCalledWith(expect.objectContaining({ enabled: true }));
  });

  it('renders expanded palette options when enabled and triggers preset, orientation, cut guides, and preview', () => {
    const onSheetConfigChange = vi.fn();
    const onOpenSheetPreview = vi.fn();
    const sheetConfig = {
      ...createDefaultSheetConfig(),
      enabled: true,
      preset: '10x15' as const
    };

    render(
      h(SettingsPanel, {
        dimension: PRESETS.nusuk,
        onDimensionChange: vi.fn(),
        exportConfig: { format: 'image/jpeg', quality: 0.95, maxBytes: MAX_NUSUK_BYTES },
        onExportConfigChange: vi.fn(),
        encodedBytes: 300_000,
        bgRemovalActive: false,
        bgLoading: false,
        featherRadius: 0,
        onToggleBgRemoval: vi.fn(),
        onFeatherChange: vi.fn(),
        sheetConfig,
        onSheetConfigChange,
        onOpenSheetPreview
      }),
      container
    );

    // Preset buttons
    const preset13x18 = Array.from(container.querySelectorAll<HTMLButtonElement>('.palette-card .preset-buttons button')).find(
      (b) => b.textContent?.includes('13×18')
    );
    expect(preset13x18).toBeDefined();
    preset13x18?.click();
    expect(onSheetConfigChange).toHaveBeenCalledWith(expect.objectContaining({ preset: '13x18', width: 18, height: 13 }));

    // Orientation toggle
    const landscapeBtn = Array.from(container.querySelectorAll<HTMLButtonElement>('.segment-btn')).find(
      (b) => b.textContent?.includes('Paysage')
    );
    expect(landscapeBtn).toBeDefined();
    landscapeBtn?.click();
    expect(onSheetConfigChange).toHaveBeenCalledWith(expect.objectContaining({ orientation: 'landscape' }));

    // Cut guides checkbox
    const cutCheckbox = container.querySelector<HTMLInputElement>('input[name="cut-guides"]');
    expect(cutCheckbox?.checked).toBe(true);
    cutCheckbox?.click();
    expect(onSheetConfigChange).toHaveBeenCalledWith(expect.objectContaining({ cutGuides: false }));

    // Info badge
    const infoBadge = container.querySelector('.palette-info-badge');
    expect(infoBadge).toBeDefined();
    expect(infoBadge?.textContent).toContain('photos par planche');

    // Preview button
    const previewBtn = container.querySelector<HTMLButtonElement>('.preview-sheet-btn');
    expect(previewBtn).toBeDefined();
    previewBtn?.click();
    expect(onOpenSheetPreview).toHaveBeenCalled();
  });

  it('renders custom dimension inputs when preset is custom', () => {
    const onSheetConfigChange = vi.fn();
    const sheetConfig = {
      ...createDefaultSheetConfig(),
      enabled: true,
      preset: 'custom' as const,
      width: 20,
      height: 30,
      unit: 'cm' as const,
      dpi: 300
    };

    render(
      h(SettingsPanel, {
        dimension: PRESETS.nusuk,
        onDimensionChange: vi.fn(),
        exportConfig: { format: 'image/jpeg', quality: 0.95, maxBytes: MAX_NUSUK_BYTES },
        onExportConfigChange: vi.fn(),
        encodedBytes: 300_000,
        bgRemovalActive: false,
        bgLoading: false,
        featherRadius: 0,
        onToggleBgRemoval: vi.fn(),
        onFeatherChange: vi.fn(),
        sheetConfig,
        onSheetConfigChange
      }),
      container
    );

    const widthInput = container.querySelector<HTMLInputElement>('#sheet-width');
    const heightInput = container.querySelector<HTMLInputElement>('#sheet-height');
    const unitSelect = container.querySelector<HTMLSelectElement>('#sheet-unit');
    const dpiInput = container.querySelector<HTMLInputElement>('#sheet-dpi');

    expect(widthInput?.value).toBe('20');
    expect(heightInput?.value).toBe('30');
    expect(unitSelect?.value).toBe('cm');
    expect(dpiInput?.value).toBe('300');

    widthInput!.value = '25';
    widthInput?.dispatchEvent(new Event('change', { bubbles: true }));
    expect(onSheetConfigChange).toHaveBeenCalledWith(expect.objectContaining({ width: 25 }));
  });
});

describe('SheetPreviewModal component', () => {
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

  it('does not render when isOpen is false', () => {
    render(
      h(SheetPreviewModal, {
        isOpen: false,
        onClose: vi.fn(),
        bitmap: null,
        transform: createDefaultTransform(),
        dimension: PRESETS.nusuk,
        sheetConfig: createDefaultSheetConfig(),
        onDownload: vi.fn()
      }),
      container
    );

    expect(container.querySelector('.sheet-modal')).toBeNull();
  });

  it('renders dialog with header, canvas, and buttons when isOpen is true', () => {
    const onClose = vi.fn();
    const onDownload = vi.fn();

    render(
      h(SheetPreviewModal, {
        isOpen: true,
        onClose,
        bitmap: null,
        transform: createDefaultTransform(),
        dimension: PRESETS.nusuk,
        sheetConfig: createDefaultSheetConfig(),
        onDownload
      }),
      container
    );

    const dialog = container.querySelector('.sheet-modal');
    expect(dialog).toBeDefined();
    expect(dialog?.getAttribute('role')).toBe('dialog');

    const title = container.querySelector('#sheet-preview-title');
    expect(title?.textContent).toContain('Aperçu de la planche photo');

    const canvas = container.querySelector('.sheet-preview-canvas');
    expect(canvas).toBeDefined();

    // Close button in header
    const closeBtn = container.querySelector<HTMLButtonElement>('.sheet-modal-close');
    closeBtn?.click();
    expect(onClose).toHaveBeenCalled();
  });

  it('closes on backdrop click and on Escape key', async () => {
    const onClose = vi.fn();

    render(
      h(SheetPreviewModal, {
        isOpen: true,
        onClose,
        bitmap: null,
        transform: createDefaultTransform(),
        dimension: PRESETS.nusuk,
        sheetConfig: createDefaultSheetConfig(),
        onDownload: vi.fn()
      }),
      container
    );

    // Allow useEffect to mount event listener
    await new Promise((r) => setTimeout(r, 20));

    // Backdrop click
    const backdrop = container.querySelector<HTMLDivElement>('.sheet-modal-backdrop');
    backdrop?.click();
    expect(onClose).toHaveBeenCalledTimes(1);

    // Escape key
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('triggers onDownload and closes when clicking download button', () => {
    const onClose = vi.fn();
    const onDownload = vi.fn();

    render(
      h(SheetPreviewModal, {
        isOpen: true,
        onClose,
        bitmap: null,
        transform: createDefaultTransform(),
        dimension: PRESETS.nusuk,
        sheetConfig: createDefaultSheetConfig(),
        onDownload
      }),
      container
    );

    const downloadBtn = container.querySelector<HTMLButtonElement>('.sheet-modal-footer .btn-primary');
    expect(downloadBtn).toBeDefined();
    downloadBtn?.click();
    expect(onDownload).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});

describe('App component', () => {
  let container: HTMLDivElement;
  let mockCtx: any;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    setLocale('fr');

    mockCtx = {
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      fillRect: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      scale: vi.fn(),
      drawImage: vi.fn(),
      clearRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      setLineDash: vi.fn()
    };

    HTMLCanvasElement.prototype.getContext = vi.fn().mockImplementation((contextId: string) => {
      if (contextId === '2d') {
        return mockCtx;
      }
      return null;
    });

    (globalThis as any).createImageBitmap = vi.fn().mockResolvedValue({
      width: 800,
      height: 600,
      close: vi.fn()
    });
  });

  afterEach(() => {
    render(null, container);
    container.remove();
  });

  function createValidJpegFile(name = 'test.jpg'): File {
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00]);
    return new File([bytes], name, { type: 'image/jpeg' });
  }

  it('renders initial landing view with Dropzone and privacy badge', () => {
    render(h(App, {}), container);

    const header = container.querySelector('.app-header');
    expect(header).toBeDefined();

    const dropzone = container.querySelector('.dropzone-container');
    expect(dropzone).toBeDefined();

    const privacy = container.querySelector('.privacy-notice');
    expect(privacy).toBeDefined();
    expect(privacy?.textContent).toContain('100%');
  });

  it('transitions to dashboard when image is loaded and supports resetting', async () => {
    render(h(App, {}), container);

    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    expect(input).not.toBeNull();

    // Create a valid image file with JPEG magic bytes
    const file = createValidJpegFile();
    Object.defineProperty(input, 'files', {
      value: [file],
      writable: true
    });

    input?.dispatchEvent(new Event('change', { bubbles: true }));

    // Wait for file validation and createImageBitmap async resolution
    await new Promise((r) => setTimeout(r, 80));

    // Dashboard should now be rendered
    const viewport = container.querySelector('.crop-viewport');
    expect(viewport).not.toBeNull();

    const toolbar = container.querySelector('.quick-toolbar');
    expect(toolbar).not.toBeNull();

    const actionBar = container.querySelector('.app-action-bar');
    expect(actionBar).not.toBeNull();

    // Test reset button: restores transform without closing the photo
    const resetBtn = container.querySelector<HTMLButtonElement>('.btn-reset');
    expect(resetBtn).not.toBeNull();
    resetBtn?.click();
    await new Promise((r) => setTimeout(r, 20));
    expect(container.querySelector('.crop-viewport')).not.toBeNull();

    // Test close photo button: closes image and returns to landing dropzone
    const closeBtn = container.querySelector<HTMLButtonElement>('.btn-close-photo');
    expect(closeBtn).not.toBeNull();
    closeBtn?.click();
    await new Promise((r) => setTimeout(r, 20));

    // Back to landing view
    const dropzoneAgain = container.querySelector('.dropzone-container');
    expect(dropzoneAgain).not.toBeNull();
  });

  it('handles quick toolbar interactions', async () => {
    render(h(App, {}), container);

    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    const file = createValidJpegFile();
    Object.defineProperty(input, 'files', {
      value: [file],
      writable: true
    });
    input?.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 80));

    // Rotate button
    const rotateBtn = Array.from(container.querySelectorAll<HTMLButtonElement>('.btn-tool')).find((b) =>
      b.textContent?.includes(t('controls.rotate'))
    );
    expect(rotateBtn).toBeDefined();
    rotateBtn?.click();

    // More tools dropdown button (displays on-demand actions: Flip, Center, Fit, Fill)
    const moreBtn = container.querySelector<HTMLButtonElement>('.toolbar-more-btn');
    expect(moreBtn).toBeDefined();
    moreBtn?.click();
    await new Promise((r) => setTimeout(r, 10));

    // Flip button inside on-demand menu
    const flipBtn = Array.from(container.querySelectorAll<HTMLButtonElement>('.toolbar-menu-item')).find((b) =>
      b.textContent?.includes(t('controls.flip'))
    );
    expect(flipBtn).toBeDefined();
    flipBtn?.click();

    // Oval guide button
    const ovalBtn = Array.from(container.querySelectorAll<HTMLButtonElement>('.btn-tool')).find((b) =>
      b.textContent?.includes(t('controls.oval_guide'))
    );
    expect(ovalBtn).toBeDefined();
    expect(ovalBtn?.classList.contains('active')).toBe(true);
    ovalBtn?.click();
    await new Promise((r) => setTimeout(r, 20));
    expect(ovalBtn?.classList.contains('active')).toBe(false);
  });

  it('manages on-demand tools menu: opens, executes tool, and closes on Escape', async () => {
    render(h(App, {}), container);

    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    const file = createValidJpegFile();
    Object.defineProperty(input, 'files', { value: [file], writable: true });
    input?.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 80));

    // By default, on-demand dropdown is not rendered
    expect(container.querySelector('.toolbar-dropdown-menu')).toBeNull();

    // Click "Autres outils" button to open menu
    const moreBtn = container.querySelector<HTMLButtonElement>('.toolbar-more-btn');
    expect(moreBtn).not.toBeNull();
    moreBtn?.click();
    await new Promise((r) => setTimeout(r, 20));

    // Menu should now be open
    const menu = container.querySelector('.toolbar-dropdown-menu');
    expect(menu).not.toBeNull();

    // Menu contains Centrer, Ajuster, Remplir, Miroir
    const menuItems = container.querySelectorAll('.toolbar-menu-item');
    expect(menuItems.length).toBe(4);

    // Escape key closes the menu
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await new Promise((r) => setTimeout(r, 20));
    expect(container.querySelector('.toolbar-dropdown-menu')).toBeNull();
  });

  it('releases GPU textures via bitmap.close() on reset and image replacement', async () => {
    const closeSpy1 = vi.fn();
    const closeSpy2 = vi.fn();

    (globalThis as any).createImageBitmap = vi
      .fn()
      .mockResolvedValueOnce({ width: 800, height: 600, close: closeSpy1 })
      .mockResolvedValueOnce({ width: 1000, height: 800, close: closeSpy2 });

    render(h(App, {}), container);

    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    const file1 = createValidJpegFile('photo1.jpg');
    Object.defineProperty(input, 'files', { value: [file1], writable: true });
    input?.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 80));

    expect(closeSpy1).not.toHaveBeenCalled();

    // Replace with second image
    const file2 = createValidJpegFile('photo2.jpg');
    Object.defineProperty(input, 'files', { value: [file2], writable: true });
    input?.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 80));

    // First bitmap should have been closed
    expect(closeSpy1).toHaveBeenCalled();

    // Close photo and return to landing view
    const closeBtn = container.querySelector<HTMLButtonElement>('.btn-close-photo');
    closeBtn?.click();
    await new Promise((r) => setTimeout(r, 20));

    // Second bitmap should have been closed
    expect(closeSpy2).toHaveBeenCalled();
  });

  it('defers URL revocation in handleDownload by 2000ms', async () => {
    const originalCreateUrl = URL.createObjectURL;
    const originalRevokeUrl = URL.revokeObjectURL;
    const revokeSpy = vi.fn();
    const createUrlSpy = vi.fn().mockReturnValue('blob:http://localhost/test-uuid');
    URL.createObjectURL = createUrlSpy;
    URL.revokeObjectURL = revokeSpy;

    const encodeSpy = vi.spyOn(exportBridge, 'renderAndEncode').mockResolvedValue({
      blob: new Blob(['mock-bytes'], { type: 'image/jpeg' }),
      width: 640,
      height: 480,
      bytes: 500_000
    });

    try {
      vi.useFakeTimers();

      render(h(App, {}), container);

      const input = container.querySelector<HTMLInputElement>('input[type="file"]');
      const file = createValidJpegFile();
      Object.defineProperty(input, 'files', { value: [file], writable: true });
      input?.dispatchEvent(new Event('change', { bubbles: true }));

      // Advance for file validation and bitmap creation
      await vi.advanceTimersByTimeAsync(80);

      // Advance for debounced encoding worker (300ms)
      await vi.advanceTimersByTimeAsync(350);

      const downloadBtn = container.querySelector<HTMLButtonElement>('.download-btn');
      expect(downloadBtn).not.toBeNull();
      expect(downloadBtn?.disabled).toBe(false);

      downloadBtn?.click();
      expect(createUrlSpy).toHaveBeenCalled();
      expect(revokeSpy).not.toHaveBeenCalled();

      // Fast-forward 1999ms: still not revoked
      await vi.advanceTimersByTimeAsync(1999);
      expect(revokeSpy).not.toHaveBeenCalled();

      // Fast-forward past 2000ms: now revoked
      await vi.advanceTimersByTimeAsync(50);
      expect(revokeSpy).toHaveBeenCalledWith('blob:http://localhost/test-uuid');
    } finally {
      vi.useRealTimers();
      URL.createObjectURL = originalCreateUrl;
      URL.revokeObjectURL = originalRevokeUrl;
      encodeSpy.mockRestore();
    }
  });

  it('notifies user if worker encoding fails unexpectedly', async () => {
    const encodeSpy = vi
      .spyOn(exportBridge, 'renderAndEncode')
      .mockRejectedValue(new Error('GPU encoding error'));

    try {
      render(h(App, {}), container);

      const input = container.querySelector<HTMLInputElement>('input[type="file"]');
      const file = createValidJpegFile();
      Object.defineProperty(input, 'files', { value: [file], writable: true });
      input?.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise((r) => setTimeout(r, 80));

      // Wait for debounced encoding (300ms + margin)
      await new Promise((r) => setTimeout(r, 350));

      const toastError = container.querySelector('.toast-error');
      expect(toastError).not.toBeNull();
      expect(toastError?.textContent).toContain('Erreur lors de la génération du fichier');
    } finally {
      encodeSpy.mockRestore();
    }
  });

  it('disables download button immediately during 300ms debounce window when transform changes', async () => {
    const encodeSpy = vi.spyOn(exportBridge, 'renderAndEncode').mockResolvedValue({
      blob: new Blob(['mock-bytes'], { type: 'image/jpeg' }),
      width: 640,
      height: 480,
      bytes: 500_000
    });

    try {
      vi.useFakeTimers();
      render(h(App, {}), container);

      const input = container.querySelector<HTMLInputElement>('input[type="file"]');
      const file = createValidJpegFile();
      Object.defineProperty(input, 'files', { value: [file], writable: true });
      input?.dispatchEvent(new Event('change', { bubbles: true }));

      // Process upload and initial encoding
      await vi.advanceTimersByTimeAsync(80);
      await vi.advanceTimersByTimeAsync(350);

      const downloadBtn = container.querySelector<HTMLButtonElement>('.download-btn');
      expect(downloadBtn?.disabled).toBe(false);

      // Trigger transform change (e.g. rotate button in quick toolbar)
      const rotateBtn = Array.from(container.querySelectorAll<HTMLButtonElement>('.quick-toolbar button')).find(
        (b) => b.textContent?.includes('Rotation')
      );
      expect(rotateBtn).toBeDefined();
      rotateBtn?.click();

      // Wait 20ms: well within the 300ms debounce calculation window, Preact re-renders and download must be disabled
      await vi.advanceTimersByTimeAsync(20);
      expect(downloadBtn?.disabled).toBe(true);

      // Advance remaining time (300ms): re-encoding finishes and download is enabled again
      await vi.advanceTimersByTimeAsync(330);
      expect(downloadBtn?.disabled).toBe(false);
    } finally {
      vi.useRealTimers();
      encodeSpy.mockRestore();
    }
  });

  it('verifies accessibility ARIA labels across App, Toolbar, SettingsPanel, and Header', async () => {
    render(h(App, {}), container);

    // Header ARIA labels
    const langSelector = container.querySelector('.lang-selector');
    expect(langSelector?.getAttribute('aria-label')).toBe('Langue');

    const themeBtn = container.querySelector('.theme-toggle-btn');
    expect(themeBtn?.getAttribute('aria-label')).toBe('Basculer le thème');

    // Load an image
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    const file = createValidJpegFile();
    Object.defineProperty(input, 'files', { value: [file], writable: true });
    input?.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 80));

    // Toolbar ARIA label
    const toolbar = container.querySelector('.quick-toolbar');
    expect(toolbar?.getAttribute('aria-label')).toBe('Outils de cadrage');

    // Settings panel ARIA label
    const settingsPanel = container.querySelector('.dashboard-settings-col');
    expect(settingsPanel?.getAttribute('aria-label')).toBe('Paramètres de retouche');

    // Presets group ARIA label
    const presetGroup = container.querySelector('.preset-buttons');
    expect(presetGroup?.getAttribute('aria-label')).toBe('Préréglages de taille');

    // Unit label translated
    const unitLabel = container.querySelector('label[for="dim-unit"]');
    expect(unitLabel?.textContent).toBe('Unité');
  });

  it('supports activating photo sheet (palette), updating action bar, and opening preview modal', async () => {
    render(h(App, {}), container);

    // Upload photo
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    const file = createValidJpegFile();
    Object.defineProperty(input, 'files', { value: [file], writable: true });
    input?.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 80));

    // Enable sheet checkbox in settings panel
    const sheetToggle = container.querySelector<HTMLInputElement>('input[name="palette-enabled"]');
    expect(sheetToggle).toBeDefined();
    sheetToggle?.click();
    await new Promise((r) => setTimeout(r, 40));

    // Action bar info should reflect the photo sheet
    const infoDim = container.querySelector('.action-info .info-dim');
    expect(infoDim?.textContent).toContain('10×15 cm');
    expect(infoDim?.textContent).toContain('photos');

    // Click preview button to open modal
    const previewBtn = container.querySelector<HTMLButtonElement>('.preview-sheet-btn');
    expect(previewBtn).toBeDefined();
    previewBtn?.click();
    await new Promise((r) => setTimeout(r, 40));

    // Modal dialog should be rendered
    const modal = document.querySelector('.sheet-modal');
    expect(modal).toBeDefined();
    expect(modal?.textContent).toContain('Aperçu de la planche photo');

    // Close modal
    const closeBtn = modal?.querySelector<HTMLButtonElement>('.sheet-modal-close');
    closeBtn?.click();
    await new Promise((r) => setTimeout(r, 40));
    expect(document.querySelector('.sheet-modal')).toBeNull();
  });
});
