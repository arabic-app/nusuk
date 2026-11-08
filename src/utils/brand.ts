// src/utils/brand.ts

export type Brand = 'nusuk' | 'portrait';

let currentBrand: Brand = 'nusuk';
const brandListeners = new Set<(brand: Brand) => void>();

/**
 * Detects whether the current session is for the "nusuk" brand or "portrait" (azure) brand.
 * Only the nusuk URL (e.g. nusuk-tools.vercel.app or any domain containing 'nusuk')
 * receives the Nusuk branding, green theme, Kaaba icon, and Nusuk-specific sizes.
 * Any other host (e.g. portrait-tools.vercel.app) gets the Azure Blue theme and generic portrait assets.
 *
 * @param customHostname Optional hostname override for testing or SSR.
 */
export function detectBrand(customHostname?: string): Brand {
  if (typeof window === 'undefined' && !customHostname) return 'nusuk';

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

export function getBrand(): Brand {
  return currentBrand;
}

export function setBrand(brand: Brand): void {
  currentBrand = brand;
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-brand', brand === 'nusuk' ? 'nusuk' : 'azure');
    const theme = document.documentElement.getAttribute('data-theme') || 'light';
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      if (brand === 'nusuk') {
        metaThemeColor.setAttribute('content', theme === 'dark' ? '#0C1511' : '#006C35');
      } else {
        metaThemeColor.setAttribute('content', theme === 'dark' ? '#0B132B' : '#0284C7');
      }
    }
  }

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
  const brand = detectBrand(customHostname);
  setBrand(brand);
  return brand;
}
