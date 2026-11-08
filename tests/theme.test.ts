import { describe, it, expect, beforeEach } from 'vitest';
import { getStoredTheme, setTheme, initTheme } from '../src/utils/theme';

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

describe('Theme manager', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('defaults to system or light theme if none stored', () => {
    const theme = initTheme();
    expect(['light', 'dark']).toContain(theme);
    expect(document.documentElement.getAttribute('data-theme')).toBe(theme);
  });

  it('persists and toggles theme', () => {
    setTheme('dark');
    expect(getStoredTheme()).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    setTheme('light');
    expect(getStoredTheme()).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });
});
