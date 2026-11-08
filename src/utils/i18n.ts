// src/utils/i18n.ts
export type Locale = 'fr' | 'ar' | 'en';
const STORAGE_KEY = 'nusuk_photo_locale';

// Embedded fallback translations for tests and instant cold boot
import frDict from '../../public/locales/fr.json';
import enDict from '../../public/locales/en.json';
import arDict from '../../public/locales/ar.json';

const translations: Record<Locale, Record<string, string>> = {
  fr: frDict,
  en: enDict,
  ar: arDict
};

let currentLocale: Locale = 'fr';
const listeners = new Set<(locale: Locale) => void>();

export function getLocale(): Locale {
  return currentLocale;
}

export function subscribeLocale(cb: (locale: Locale) => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export async function setLocale(locale: Locale): Promise<void> {
  currentLocale = locale;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, locale);
    }
  } catch {
    // Ignore storage errors in restricted contexts
  }

  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
  }

  listeners.forEach(cb => {
    try {
      cb(locale);
    } catch {
      // Isolate listener errors
    }
  });
}

export function initLocale(): Locale {
  let stored: Locale | null = null;
  try {
    if (typeof localStorage !== 'undefined') {
      stored = localStorage.getItem(STORAGE_KEY) as Locale | null;
    }
  } catch {
    stored = null;
  }

  if (stored && (stored === 'fr' || stored === 'ar' || stored === 'en')) {
    setLocale(stored);
    return stored;
  }

  const browserLang =
    typeof navigator !== 'undefined' && navigator.language
      ? navigator.language.slice(0, 2).toLowerCase()
      : 'en';

  const initial: Locale = browserLang === 'ar' ? 'ar' : browserLang === 'fr' ? 'fr' : 'en';
  setLocale(initial);
  return initial;
}

export function t(key: string, params?: Record<string, string | number>): string {
  let str = translations[currentLocale]?.[key] || translations['en']?.[key] || key;
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      str = str.replace(new RegExp(`{{${k}}}`, 'g'), String(v));
    });
  }
  return str;
}
