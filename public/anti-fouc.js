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

  function applyPwaBrand() {
    const metaColor = document.querySelector('meta[name="theme-color"]');
    const metaDesc = document.querySelector('meta[name="description"]');
    const metaAppleTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
    const appleIcon = document.querySelector('link[rel="apple-touch-icon"]');
    const favicon = document.querySelector('link[rel="icon"]');
    let manifest = document.querySelector('link[rel="manifest"]');

    if (isNusuk) {
      document.title = "Nusuk Photo — Recadrage photo Hajj & Omra";
      if (metaColor) metaColor.setAttribute('content', theme === 'dark' ? '#0C1511' : '#006C35');
      if (metaDesc) metaDesc.setAttribute('content', "Recadrage et mise en conformité de photos d'identité pour le portail Hajj Nusuk (480x640, fond blanc, < 1 Mo).");
      if (metaAppleTitle) metaAppleTitle.setAttribute('content', 'Nusuk Photo');
      if (appleIcon) appleIcon.setAttribute('href', '/icons/apple-touch-icon-180x180.png');
      if (favicon) favicon.setAttribute('href', "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🕋</text></svg>");
      if (manifest) manifest.setAttribute('href', '/manifest.webmanifest');
    } else {
      document.title = "Portrait Photo — Recadrage photo d'identité & passeport";
      if (metaColor) metaColor.setAttribute('content', theme === 'dark' ? '#0B132B' : '#0284C7');
      if (metaDesc) metaDesc.setAttribute('content', "Recadrage et mise en conformité de photos d'identité et passeports (fond blanc, formats officiels).");
      if (metaAppleTitle) metaAppleTitle.setAttribute('content', 'Portrait Photo');
      if (appleIcon) appleIcon.setAttribute('href', '/icons/portrait-apple-touch-icon-180x180.png');
      if (favicon) favicon.setAttribute('href', "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📷</text></svg>");
      if (manifest) {
        manifest.setAttribute('href', '/manifest-portrait.webmanifest');
      } else {
        manifest = document.createElement('link');
        manifest.setAttribute('rel', 'manifest');
        manifest.setAttribute('href', '/manifest-portrait.webmanifest');
        document.head.appendChild(manifest);
      }
    }
  }

  applyPwaBrand();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyPwaBrand);
  }
})();
