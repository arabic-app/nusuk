// src/utils/brand.ts

export type Brand = 'nusuk' | 'portrait';

/**
 * Detects whether the current session is for the "nusuk" brand or "portrait" (azure) brand.
 * Only the nusuk URL (e.g. nusuk-tools.vercel.app or any domain containing 'nusuk')
 * receives the Nusuk branding, green theme, Kaaba icon, and Nusuk-specific sizes.
 * Any other host (e.g. portrait-tools.vercel.app) gets the Azure Blue theme and generic portrait assets.
 *
 * @param customHostname Optional hostname override for testing or SSR.
 */
export function detectBrand(customHostname?: string): Brand {
  if (typeof window === 'undefined' && !customHostname) return 'portrait';

  const hostname = (customHostname ?? window.location.hostname).toLowerCase();

  // Allow query param override (?brand=nusuk or ?brand=portrait)
  if (!customHostname && typeof window !== 'undefined') {
    try {
      const params = new URLSearchParams(window.location.search);
      const b = params.get('brand');
      if (b === 'nusuk') return 'nusuk';
      if (b === 'portrait') return 'portrait';
    } catch {
      // Gracefully ignore URL parse issues
    }
  }

  if (hostname.includes('nusuk')) {
    return 'nusuk';
  }

  return 'portrait';
}

let currentBrand: Brand = typeof window !== 'undefined' ? detectBrand() : 'portrait';
let brandExplicitlySet = false;
const brandListeners = new Set<(brand: Brand) => void>();

export function getBrand(): Brand {
  return currentBrand;
}

export interface BrandMetadata {
  title: string;
  shortTitle: string;
  description: string;
  themeColor: { light: string; dark: string };
  appleTouchIcon: string;
  favicon: string;
  manifest: string;
}

export function getBrandMetadata(brand: Brand): BrandMetadata {
  if (brand === 'nusuk') {
    return {
      title: 'Nusuk Photo — Recadrage photo Hajj & Omra',
      shortTitle: 'Nusuk Photo',
      description: "Recadrage et mise en conformité de photos d'identité pour le portail Hajj Nusuk (480x640, fond blanc, < 1 Mo).",
      themeColor: { light: '#006C35', dark: '#0C1511' },
      appleTouchIcon: '/icons/apple-touch-icon-180x180.png',
      favicon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🕋</text></svg>",
      manifest: '/manifest.webmanifest'
    };
  }
  return {
    title: "Portrait Photo — Recadrage photo d'identité & passeport",
    shortTitle: 'Portrait Photo',
    description: "Recadrage et mise en conformité de photos d'identité et passeports (fond blanc, formats officiels).",
    themeColor: { light: '#0284C7', dark: '#0B132B' },
    appleTouchIcon: '/icons/portrait-apple-touch-icon-180x180.png',
    favicon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📷</text></svg>",
    manifest: '/manifest-portrait.webmanifest'
  };
}

export function applyBrandToDom(brand: Brand): void {
  if (typeof document === 'undefined') return;

  const meta = getBrandMetadata(brand);
  document.documentElement.setAttribute('data-brand', brand === 'nusuk' ? 'nusuk' : 'azure');
  document.title = meta.title;

  const theme = document.documentElement.getAttribute('data-theme') || 'light';
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.setAttribute('content', theme === 'dark' ? meta.themeColor.dark : meta.themeColor.light);
  }

  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) {
    metaDesc.setAttribute('content', meta.description);
  }

  const metaAppleTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
  if (metaAppleTitle) {
    metaAppleTitle.setAttribute('content', meta.shortTitle);
  }

  const appleTouchIcon = document.querySelector('link[rel="apple-touch-icon"]');
  if (appleTouchIcon) {
    appleTouchIcon.setAttribute('href', meta.appleTouchIcon);
  }

  const favicon = document.querySelector('link[rel="icon"]');
  if (favicon) {
    favicon.setAttribute('href', meta.favicon);
  }

  let manifestLink = document.querySelector('link[rel="manifest"]');
  if (manifestLink) {
    manifestLink.setAttribute('href', meta.manifest);
  } else {
    manifestLink = document.createElement('link');
    manifestLink.setAttribute('rel', 'manifest');
    manifestLink.setAttribute('href', meta.manifest);
    document.head.appendChild(manifestLink);
  }
}

export function setBrand(brand: Brand): void {
  currentBrand = brand;
  brandExplicitlySet = true;
  applyBrandToDom(brand);

  brandListeners.forEach((cb) => {
    try {
      cb(brand);
    } catch {
      // Ignore listener errors
    }
  });
}

export function subscribeBrand(cb: (brand: Brand) => void): () => void {
  brandListeners.add(cb);
  return () => {
    brandListeners.delete(cb);
  };
}

export function initBrand(customHostname?: string): Brand {
  if (customHostname || !brandExplicitlySet) {
    const brand = detectBrand(customHostname);
    setBrand(brand);
    return brand;
  }
  setBrand(currentBrand);
  return currentBrand;
}
