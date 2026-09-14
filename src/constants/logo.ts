// ═══════════════════════════════════════════════════════════════════════════
// 3amory phone - Logo & Brand Assets Resolver
// ═══════════════════════════════════════════════════════════════════════════

import defaultLogoAsset from '../assets/logo-removebg-preview.png';

export const DEFAULT_LOGO = defaultLogoAsset;

/**
 * Returns a robust, guaranteed-to-load URL for the store logo.
 * Supports:
 * - base64 Data URLs (stored in IndexedDB when user uploads a custom logo)
 * - Bundled static asset fallback
 */
export function getStoreLogo(customLogo?: string | null): string {
  if (customLogo && typeof customLogo === 'string') {
    const trimmed = customLogo.trim();
    // 1. Data URL (Base64) - Always valid
    if (trimmed.startsWith('data:image/')) {
      return trimmed;
    }
    // 2. Relative or HTTP URL
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('./')) {
      return trimmed;
    }
  }
  return DEFAULT_LOGO;
}
