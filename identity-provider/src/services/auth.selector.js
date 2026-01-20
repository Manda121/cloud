const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY;
const CONNECTIVITY_TIMEOUT = parseInt(process.env.FIREBASE_CONNECTIVITY_TIMEOUT || '3000', 10);

// Cache pour éviter de vérifier la connectivité à chaque requête
let lastConnectivityCheck = null;
let isOnlineCache = null;
const CACHE_DURATION = 30000; // 30 secondes

/**
 * Vérifie si Firebase est accessible en ligne
 * @returns {Promise<boolean>}
 */
async function checkFirebaseConnectivity() {
  // Vérifier le cache
  if (lastConnectivityCheck && (Date.now() - lastConnectivityCheck) < CACHE_DURATION) {
    return isOnlineCache;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONNECTIVITY_TIMEOUT);

    // Test simple de connectivité vers Firebase
    const response = await fetch('https://www.googleapis.com/identitytoolkit/v3/relyingparty/getProjectConfig?key=' + (FIREBASE_API_KEY || 'test'), {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    
    // Même si la clé API est invalide, si on reçoit une réponse, on est en ligne
    isOnlineCache = true;
    lastConnectivityCheck = Date.now();
    console.log('[Auth Selector] Firebase accessible - Mode ONLINE');
    return true;
  } catch (error) {
    isOnlineCache = false;
    lastConnectivityCheck = Date.now();
    console.log('[Auth Selector] Firebase inaccessible - Mode OFFLINE:', error.message);
    return false;
  }
}

/**
 * Détermine si on doit utiliser Firebase basé sur le mode configuré
 * @returns {boolean} - true si USE_FIREBASE est activé (pour compatibilité)
 */
function useFirebase() {
  const authMode = process.env.AUTH_MODE || 'auto';
  
  if (authMode === 'firebase') return true;
  if (authMode === 'local') return false;
  
  // Mode auto ou ancien paramètre USE_FIREBASE
  return process.env.USE_FIREBASE === 'true';
}

/**
 * Détermine si on est actuellement en ligne (Firebase accessible)
 * @returns {Promise<boolean>}
 */
async function isOnline() {
  const authMode = process.env.AUTH_MODE || 'auto';
  
  if (authMode === 'firebase') return true;
  if (authMode === 'local') return false;
  
  // Mode auto: vérifier la connectivité
  return await checkFirebaseConnectivity();
}

/**
 * Force le rafraîchissement du cache de connectivité
 */
function resetConnectivityCache() {
  lastConnectivityCheck = null;
  isOnlineCache = null;
}

/**
 * Retourne le mode d'authentification actuel
 * @returns {Promise<string>} - 'firebase' ou 'local'
 */
async function getCurrentAuthMode() {
  const online = await isOnline();
  return online ? 'firebase' : 'local';
}

module.exports = { 
  useFirebase, 
  isOnline, 
  checkFirebaseConnectivity, 
  resetConnectivityCache,
  getCurrentAuthMode 
};
