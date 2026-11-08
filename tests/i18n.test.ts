import { describe, it, expect, beforeEach } from 'vitest';
import { setLocale, t, getLocale, initLocale, subscribeLocale } from '../src/utils/i18n';

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

describe('i18n engine', () => {
  beforeEach(async () => {
    localStorage.clear();
    document.documentElement.removeAttribute('dir');
    document.documentElement.removeAttribute('lang');
  });

  it('translates keys and applies RTL to html when Arabic', async () => {
    await setLocale('fr');
    expect(document.documentElement.getAttribute('dir')).toBe('ltr');
    expect(document.documentElement.getAttribute('lang')).toBe('fr');
    expect(getLocale()).toBe('fr');
    expect(t('app.title')).toBe('Nusuk Photo');

    await setLocale('ar');
    expect(document.documentElement.getAttribute('dir')).toBe('rtl');
    expect(document.documentElement.getAttribute('lang')).toBe('ar');
    expect(getLocale()).toBe('ar');
    expect(t('app.title')).toBe('نسك فوتو');
  });

  it('supports interpolation in strings safely without regex injection bugs', async () => {
    await setLocale('fr');
    expect(t('export.quality_adjusted', { quality: '0.88' })).toContain('0.88');
    expect(t('weight.gauge', { size: '100$' })).toContain('100$');
  });

  it('notifies subscribers on locale change', async () => {
    const changes: string[] = [];
    const unsubscribe = subscribeLocale(loc => changes.push(loc));

    await setLocale('en');
    await setLocale('ar');
    expect(changes).toEqual(['en', 'ar']);

    unsubscribe();
    await setLocale('fr');
    expect(changes).toEqual(['en', 'ar']);
  });

  it('initializes locale from stored preference or browser language', () => {
    localStorage.setItem('nusuk_photo_locale', 'ar');
    const loc = initLocale();
    expect(loc).toBe('ar');
    expect(getLocale()).toBe('ar');
    expect(document.documentElement.getAttribute('dir')).toBe('rtl');
  });

  it('falls back to English when key missing in locale, or returns key if nowhere', async () => {
    await setLocale('fr');
    expect(t('nonexistent.key.xyz')).toBe('nonexistent.key.xyz');
  });
});
