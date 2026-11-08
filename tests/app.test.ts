// tests/app.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { h, render } from 'preact';
import { Header } from '../src/components/Header';
import { ActionBar } from '../src/components/ActionBar';
import { SettingsPanel } from '../src/components/SettingsPanel';
import { App } from '../src/App';
import { getExportFilename, MAX_NUSUK_BYTES } from '../src/utils/exportBridge';
import { PRESETS } from '../src/utils/dimensions';
import { setLocale, getLocale } from '../src/utils/i18n';
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

  it('supports switching language between FR, AR, EN', async () => {
    render(h(Header, {}), container);
    const langBtns = container.querySelectorAll<HTMLButtonElement>('.lang-btn');
    expect(langBtns.length).toBe(3);

    // Switch to EN
    const enBtn = Array.from(langBtns).find(b => b.textContent?.trim() === 'EN');
    expect(enBtn).toBeDefined();
    enBtn?.click();
    await new Promise(r => setTimeout(r, 10));

    expect(getLocale()).toBe('en');
    const updatedEnBtn = Array.from(container.querySelectorAll<HTMLButtonElement>('.lang-btn')).find(b => b.textContent?.trim() === 'EN');
    expect(updatedEnBtn?.classList.contains('active')).toBe(true);

    // Switch to AR
    const arBtn = Array.from(container.querySelectorAll<HTMLButtonElement>('.lang-btn')).find(b => b.textContent?.includes('العربية'));
    expect(arBtn).toBeDefined();
    arBtn?.click();
    await new Promise(r => setTimeout(r, 10));

    expect(getLocale()).toBe('ar');
    const updatedArBtn = Array.from(container.querySelectorAll<HTMLButtonElement>('.lang-btn')).find(b => b.textContent?.includes('العربية'));
    expect(updatedArBtn?.classList.contains('active')).toBe(true);
  });

  it('toggles theme between light and dark', async () => {
    render(h(Header, {}), container);
    const themeBtn = container.querySelector<HTMLButtonElement>('.theme-toggle-btn');
    expect(themeBtn).toBeDefined();

    expect(themeBtn?.textContent?.trim()).toBe('🌙');

    themeBtn?.click();
    await new Promise(r => setTimeout(r, 10));
    const updatedDarkBtn = container.querySelector<HTMLButtonElement>('.theme-toggle-btn');
    expect(updatedDarkBtn?.textContent?.trim()).toBe('☀️');
    expect(getStoredTheme()).toBe('dark');

    updatedDarkBtn?.click();
    await new Promise(r => setTimeout(r, 10));
    const updatedLightBtn = container.querySelector<HTMLButtonElement>('.theme-toggle-btn');
    expect(updatedLightBtn?.textContent?.trim()).toBe('🌙');
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
      fillRect: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      scale: vi.fn(),
      drawImage: vi.fn(),
      clearRect: vi.fn()
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

    // Test reset button
    const resetBtn = container.querySelector<HTMLButtonElement>('.btn-danger');
    expect(resetBtn).not.toBeNull();
    resetBtn?.click();

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
      b.textContent?.includes('🔄')
    );
    expect(rotateBtn).toBeDefined();
    rotateBtn?.click();

    // Flip button
    const flipBtn = Array.from(container.querySelectorAll<HTMLButtonElement>('.btn-tool')).find((b) =>
      b.textContent?.includes('🪞')
    );
    expect(flipBtn).toBeDefined();
    flipBtn?.click();

    // Oval guide button
    const ovalBtn = Array.from(container.querySelectorAll<HTMLButtonElement>('.btn-tool')).find((b) =>
      b.textContent?.includes('👤')
    );
    expect(ovalBtn).toBeDefined();
    expect(ovalBtn?.classList.contains('active')).toBe(true);
    ovalBtn?.click();
    await new Promise((r) => setTimeout(r, 20));
    expect(ovalBtn?.classList.contains('active')).toBe(false);
  });
});
