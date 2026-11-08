export type Theme = 'light' | 'dark';
const STORAGE_KEY = 'nusuk_photo_theme';

export function getStoredTheme(): Theme | null {
  try {
    const val = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    return val === 'light' || val === 'dark' ? val : null;
  } catch {
    return null;
  }
}

export function setTheme(theme: Theme): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, theme);
    }
  } catch {
    // Ignore storage errors in restricted contexts
  }
  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.style.colorScheme = theme;
}

export function initTheme(): Theme {
  const stored = getStoredTheme();
  if (stored) {
    setTheme(stored);
    return stored;
  }
  const prefersDark =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : false;
  const initial: Theme = prefersDark ? 'dark' : 'light';
  setTheme(initial);
  return initial;
}
