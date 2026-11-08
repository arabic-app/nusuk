// src/components/Header.tsx
import { useState, useEffect } from 'preact/hooks';
import { Locale, setLocale, getLocale, subscribeLocale, t } from '../utils/i18n';
import { Theme, setTheme, getStoredTheme } from '../utils/theme';

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
        <span class="brand-logo" aria-hidden="true">🕋</span>
        <div>
          <h1 class="brand-title">{t('app.title')}</h1>
          <p class="brand-tagline">{t('app.tagline')}</p>
        </div>
      </div>

      <div class="header-actions">
        <div class="lang-selector" role="group" aria-label="Langue / Language">
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
          aria-label="Basculer le thème"
          title="Basculer le thème"
        >
          {theme === 'light' ? '🌙' : '☀️'}
        </button>
      </div>
    </header>
  );
}
