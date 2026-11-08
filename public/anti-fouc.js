(function() {
  const theme = localStorage.getItem('nusuk_photo_theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.style.colorScheme = theme;
  const locale = localStorage.getItem('nusuk_photo_locale') || (navigator.language.startsWith('ar') ? 'ar' : 'fr');
  document.documentElement.lang = locale;
  document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
})();
