/**
 * Résolution automatique de l'URL du backend
 *
 * Essaie plusieurs URLs pour trouver le backend :
 * 1. URL configurée dans .env (VITE_API_URL)
 * 2. Android Emulator → http://10.0.2.2:3000
 * 3. IP locale du PC (Wi-Fi) → http://192.168.88.231:3000
 * 4. localhost (navigateur web)
 *
 * Le résultat est mis en cache pour éviter de ping à chaque requête.
 */

const CONFIGURED_URL = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:3000';

// Liste des URLs candidates (ordre d'essai)
const CANDIDATE_URLS: string[] = [
  CONFIGURED_URL,
  'http://10.0.2.2:3000',       // Android Emulator
  'http://192.168.88.231:3000', // IP locale Wi-Fi du PC
  'http://localhost:3000',       // Web / browser
].filter((url, i, arr) => arr.indexOf(url) === i); // dédupliquer

let _resolvedUrl: string | null = null;
let _resolvedAt = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Teste si une URL répond dans un délai court
 */
async function ping(url: string, timeoutMs = 3000): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(`${url}/api/auth/status`, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Trouve l'URL backend joignable et la met en cache.
 * Retourne null si aucun backend n'est joignable.
 */
export async function resolveBackendUrl(): Promise<string | null> {
  // Cache valide ?
  if (_resolvedUrl && Date.now() - _resolvedAt < CACHE_TTL) {
    return _resolvedUrl;
  }

  // Essayer chaque URL candidate
  for (const url of CANDIDATE_URLS) {
    console.log('[Backend] Trying', url, '...');
    if (await ping(url)) {
      console.log('[Backend] Resolved →', url);
      _resolvedUrl = url;
      _resolvedAt = Date.now();
      return url;
    }
  }

  console.warn('[Backend] Aucun backend joignable');
  _resolvedUrl = null;
  _resolvedAt = 0;
  return null;
}

/**
 * Retourne true si le backend est joignable (en utilisant le cache si récent).
 */
export async function isBackendReachable(): Promise<boolean> {
  return (await resolveBackendUrl()) !== null;
}

/**
 * Retourne l'URL backend actuellement connue.
 * Utilise le cache si disponible, sinon fallback sur la valeur .env.
 */
export function getBackendUrl(): string {
  return _resolvedUrl ?? CONFIGURED_URL;
}

/**
 * Force le rafraîchissement du cache (ex: après une déconnexion réseau)
 */
export function resetBackendCache(): void {
  _resolvedUrl = null;
  _resolvedAt = 0;
}
