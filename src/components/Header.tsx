// src/components/Header.tsx
import { useState, useEffect } from 'preact/hooks';
import { Locale, setLocale, getLocale, subscribeLocale, t } from '../utils/i18n';
import { Theme, setTheme, getStoredTheme } from '../utils/theme';
import { IconKaaba, IconMoon, IconSun } from './Icons';

export function Header() {
  const [currentLocale, setCurrentLocaleState] = useState<Locale>(getLocale());
  const [theme, setThemeState] = useState<Theme>(getStoredTheme() || 'light');

  useEffect(() => {
    return subscribeLocale((l) => {
      setCurrentLocaleState(l);
    });
  }, []);

  const onSelectLocale = (l: Locale) => {
    setLocale(l);
    setCurrentLocaleState(l);
  };

  const toggleTheme = () => {
    const next: Theme = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    setThemeState(next);
  };

  return (
    <header class="app-header">
      <div class="header-brand">
        <span class="brand-logo" aria-hidden="true">
          <IconKaaba size={28} />
        </span>
        <div>
          <h1 class="brand-title">{t('app.title')}</h1>
          <p class="brand-tagline">{t('app.tagline')}</p>
        </div>
      </div>

      <div class="header-actions">
        <div class="lang-selector" role="group" aria-label={t('aria.lang_selector')}>
          <button
            type="button"
            class={`lang-btn ${currentLocale === 'fr' ? 'active' : ''}`}
            onClick={() => onSelectLocale('fr')}
            aria-pressed={currentLocale === 'fr'}
          >
            FR
          </button>
          <button
            type="button"
            class={`lang-btn ${currentLocale === 'ar' ? 'active' : ''}`}
            onClick={() => onSelectLocale('ar')}
            aria-pressed={currentLocale === 'ar'}
          >
            العربية
          </button>
          <button
            type="button"
            class={`lang-btn ${currentLocale === 'en' ? 'active' : ''}`}
            onClick={() => onSelectLocale('en')}
            aria-pressed={currentLocale === 'en'}
          >
            EN
          </button>
        </div>

        <button
          type="button"
          class="theme-toggle-btn"
          onClick={toggleTheme}
          aria-label={t('aria.theme_toggle')}
          title={t('aria.theme_toggle')}
        >
          {theme === 'light' ? (
            <IconMoon size={18} class="icon-moon" />
          ) : (
            <IconSun size={18} class="icon-sun" />
          )}
        </button>
      </div>
    </header>
  );
}
