// src/components/Header.tsx
import { useState, useEffect, useRef } from 'preact/hooks';
import { Locale, setLocale, getLocale, subscribeLocale, t } from '../utils/i18n';
import { Theme, setTheme, getTheme, subscribeTheme } from '../utils/theme';
import { IconKaaba, IconMoon, IconSun, IconGlobe, IconChevronDown, IconCheck } from './Icons';

const LANGUAGES: { code: Locale; label: string; short: string }[] = [
  { code: 'fr', label: 'Français', short: 'FR' },
  { code: 'ar', label: 'العربية', short: 'AR' },
  { code: 'en', label: 'English', short: 'EN' },
];

export function Header() {
  const [currentLocale, setCurrentLocaleState] = useState<Locale>(getLocale());
  const [theme, setThemeState] = useState<Theme>(getTheme());
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return subscribeLocale((l) => {
      setCurrentLocaleState(l);
    });
  }, []);

  useEffect(() => {
    return subscribeTheme((nextTheme) => {
      setThemeState(nextTheme);
    });
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('click', handleOutsideClick);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('click', handleOutsideClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const onSelectLocale = (l: Locale) => {
    setLocale(l);
    setCurrentLocaleState(l);
    setIsOpen(false);
  };

  const toggleTheme = () => {
    const next: Theme = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    setThemeState(next);
  };

  const currentLang = LANGUAGES.find((l) => l.code === currentLocale) || LANGUAGES[0];

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
        <div class="lang-selector lang-dropdown" ref={dropdownRef} aria-label={t('aria.lang_selector')}>
          <button
            type="button"
            class="lang-dropdown-trigger"
            onClick={() => setIsOpen(!isOpen)}
            aria-haspopup="listbox"
            aria-expanded={isOpen}
            aria-label={t('aria.lang_selector')}
          >
            <IconGlobe size={16} class="lang-globe-icon" />
            <span class="lang-current-code">{currentLang.short}</span>
            <IconChevronDown size={13} class={`lang-chevron ${isOpen ? 'open' : ''}`} />
          </button>

          {isOpen && (
            <div class="lang-dropdown-menu" role="listbox">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  class={`lang-dropdown-item ${currentLocale === lang.code ? 'active' : ''}`}
                  onClick={() => onSelectLocale(lang.code)}
                  role="option"
                  aria-selected={currentLocale === lang.code}
                >
                  <span class="lang-item-name">{lang.label}</span>
                  <span class="lang-item-badge">{lang.short}</span>
                  {currentLocale === lang.code && (
                    <IconCheck size={14} class="lang-item-check" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          class="theme-toggle-btn"
          onClick={toggleTheme}
          aria-label={t('aria.theme_toggle')}
          title={t('aria.theme_toggle')}
        >
          {theme === 'dark' ? (
            <IconMoon size={18} class="icon-moon" />
          ) : (
            <IconSun size={18} class="icon-sun" />
          )}
        </button>
      </div>
    </header>
  );
}
