(function() {
  const isNusuk = window.location.hostname.includes('nusuk') || window.location.search.includes('brand=nusuk');
  const brand = isNusuk ? 'nusuk' : 'azure';
  document.documentElement.setAttribute('data-brand', brand);

  const theme = localStorage.getItem('nusuk_photo_theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.style.colorScheme = theme;
  const locale = localStorage.getItem('nusuk_photo_locale') || (navigator.language.startsWith('ar') ? 'ar' : 'fr');
  document.documentElement.lang = locale;
  document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';

  if (!isNusuk) {
    document.title = "Portrait Photo — Recadrage photo d'identité & passeport";
    const metaColor = document.querySelector('meta[name="theme-color"]');
    if (metaColor) {
      metaColor.setAttribute('content', theme === 'dark' ? '#0B132B' : '#0284C7');
    }
    const icon = document.querySelector('link[rel="icon"]');
    if (icon) {
      icon.setAttribute('href', "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📷</text></svg>");
    }
  }
})();
