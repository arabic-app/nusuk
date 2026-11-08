import { getBrand } from './brand';

export type Theme = 'light' | 'dark';
const STORAGE_KEY = 'nusuk_photo_theme';

const themeListeners = new Set<(theme: Theme) => void>();

export function getStoredTheme(): Theme | null {
  try {
    const val = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    return val === 'light' || val === 'dark' ? val : null;
  } catch {
    return null;
  }
}

export function getSystemTheme(): Theme {
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

export function getTheme(): Theme {
  const stored = getStoredTheme();
  if (stored) return stored;

  if (typeof document !== 'undefined') {
    const docTheme = document.documentElement.getAttribute('data-theme');
    if (docTheme === 'light' || docTheme === 'dark') {
      return docTheme;
    }
  }

  return getSystemTheme();
}

export function subscribeTheme(cb: (theme: Theme) => void): () => void {
  themeListeners.add(cb);
  return () => {
    themeListeners.delete(cb);
  };
}

export function setTheme(theme: Theme): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, theme);
    }
  } catch {
    // Ignore storage errors in restricted contexts
  }
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.colorScheme = theme;
    const brand = getBrand();
    document.documentElement.setAttribute('data-brand', brand === 'nusuk' ? 'nusuk' : 'azure');
    const metaColor = document.querySelector('meta[name="theme-color"]');
    if (metaColor) {
      if (brand === 'nusuk') {
        metaColor.setAttribute('content', theme === 'dark' ? '#0C1511' : '#006C35');
      } else {
        metaColor.setAttribute('content', theme === 'dark' ? '#0B132B' : '#0284C7');
      }
    }
  }
  themeListeners.forEach((cb) => {
    try {
      cb(theme);
    } catch {
      // Ignore listener error
    }
  });
}

let mediaQueryListenerAttached = false;

export function initTheme(): Theme {
  const stored = getStoredTheme();
  const theme = stored || getSystemTheme();
  setTheme(theme);

  if (
    !mediaQueryListenerAttached &&
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function'
  ) {
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      // Only auto-switch if user hasn't explicitly set a preference in storage
      if (!getStoredTheme()) {
        const next = e.matches ? 'dark' : 'light';
        setTheme(next);
      }
    };
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', handler);
      mediaQueryListenerAttached = true;
    } else if (typeof mql.addListener === 'function') {
      mql.addListener(handler);
      mediaQueryListenerAttached = true;
    }
  }

  return theme;
}
