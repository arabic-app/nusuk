// src/utils/features.ts

/**
 * Determines whether the "Planche photo" (Photo Sheet) feature should be enabled.
 * In production, it is strictly enabled ONLY for portrait-tools.vercel.app (and related preview deployments).
 * On nusuk-tools.vercel.app in production, it is hidden.
 * In development and test environments (localhost, 127.0.0.1, dev mode, vitest), it remains enabled by default.
 *
 * @param customHostname Optional hostname override (useful for testing or SSR).
 */
export function isPhotoSheetEnabled(customHostname?: string): boolean {
  if (typeof window === 'undefined' && !customHostname) return true;

  const hostname = (customHostname ?? window.location.hostname).toLowerCase();

  // Allow URL query override for quick QA/debugging (?sheet=true/false or ?palette=1/0)
  if (!customHostname && typeof window !== 'undefined') {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.has('palette') || params.has('sheet')) {
        const val = params.get('palette') ?? params.get('sheet');
        if (val === '0' || val === 'false') return false;
        if (val === '1' || val === 'true') return true;
      }
    } catch {
      // Gracefully ignore URL parse issues
    }
  }

  const isLocalOrTest =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '' ||
    hostname.endsWith('.local') ||
    import.meta.env.DEV ||
    import.meta.env.MODE === 'test';

  if (!customHostname && isLocalOrTest) {
    return true;
  }

  // In production, enable strictly for portrait-tools.vercel.app (and its Vercel preview branches)
  return (
    hostname === 'portrait-tools.vercel.app' ||
    hostname.includes('portrait-tools')
  );
}
