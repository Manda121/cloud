/**
 * Service d'authentification HYBRIDE
 * 
 * Stratégie :
 * 1. Essayer d'abord via le backend (identity-provider) si disponible
 * 2. Si le backend est indisponible (Failed to fetch), fallback sur Firebase direct
 * 3. Les signalements sont stockés dans Firestore quand le backend est down
 * 
 * Cela permet à l'app de fonctionner sur n'importe quel appareil,
 * même sans le backend Docker lancé sur votre PC.
 */

import { auth as firebaseAuth } from './firebase';
import { isBackendReachable, getBackendUrl } from './backend';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut as firebaseSignOut,
  signInAnonymously,
} from 'firebase/auth';

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';
const AUTH_MODE_KEY = 'auth_mode'; // 'backend' ou 'firebase-direct'

export interface AuthUser {
  id?: number;
  uid?: string;
  email: string;
  firebase_uid?: string;
  displayName?: string;
}

export interface LoginResponse {
  token: string;
  user?: AuthUser;
  uid?: string;
  email?: string;
  authMode: 'local' | 'firebase' | 'firebase-direct';
  message?: string;
}

export interface RegisterResponse {
  idToken?: string;
  localId?: string;
  email?: string;
  authMode: 'local' | 'firebase' | 'firebase-direct';
  message?: string;
  id?: number;
}

/**
 * Login via Firebase directement (sans backend)
 */
async function loginFirebaseDirect(email: string, password: string): Promise<LoginResponse> {
  console.log('[Auth] Login Firebase direct...');
  const userCredential = await signInWithEmailAndPassword(firebaseAuth, email, password);
  const user = userCredential.user;
  const idToken = await user.getIdToken();

  // Stocker le token et les infos
  localStorage.setItem(TOKEN_KEY, idToken);
  localStorage.setItem(AUTH_MODE_KEY, 'firebase-direct');

  const authUser: AuthUser = {
    uid: user.uid,
    email: user.email || email,
    firebase_uid: user.uid,
    displayName: user.displayName || undefined,
  };
  localStorage.setItem(USER_KEY, JSON.stringify(authUser));

  return {
    token: idToken,
    user: authUser,
    uid: user.uid,
    email: user.email || email,
    authMode: 'firebase-direct',
    message: 'Connexion Firebase directe (backend indisponible)',
  };
}

/**
 * Login via le backend (identity-provider)
 */
async function loginViaBackend(email: string, password: string): Promise<LoginResponse> {
  const API_BASE = getBackendUrl();
  const url = `${API_BASE}/api/auth/login`;
  console.log('[Auth] Login via backend:', url);

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erreur de connexion' }));
    throw new Error(error.error || `Erreur ${response.status}`);
  }

  const data: LoginResponse = await response.json();

  if (data.token) {
    localStorage.setItem(TOKEN_KEY, data.token);
  }
  localStorage.setItem(AUTH_MODE_KEY, 'backend');

  const user: AuthUser = data.user || {
    uid: data.uid,
    email: data.email || email,
  };
  localStorage.setItem(USER_KEY, JSON.stringify(user));

  return data;
}

/**
 * Connexion hybride : backend d'abord, puis Firebase direct en fallback
 */
export async function login(email: string, password: string): Promise<LoginResponse> {
  console.log('[Auth] Attempting hybrid login...');

  // 1. Essayer via le backend
  try {
    const backendReachable = await isBackendReachable();
    if (backendReachable) {
      return await loginViaBackend(email, password);
    }
  } catch (err: any) {
    console.warn('[Auth] Backend login failed:', err.message);
  }

  // 2. Fallback : Firebase direct
  try {
    return await loginFirebaseDirect(email, password);
  } catch (err: any) {
    console.error('[Auth] Firebase direct login failed:', err.message);
    // Traduire les erreurs Firebase en messages user-friendly
    const msg = translateFirebaseError(err.code || err.message);
    throw new Error(msg);
  }
}

/**
 * Register via Firebase directement (sans backend)
 */
async function registerFirebaseDirect(
  email: string,
  password: string,
  firstname?: string,
  lastname?: string,
): Promise<RegisterResponse> {
  console.log('[Auth] Register Firebase direct...');
  const userCredential = await createUserWithEmailAndPassword(firebaseAuth, email, password);
  const user = userCredential.user;

  // Mettre à jour le profil avec le nom
  const displayName = [firstname, lastname].filter(Boolean).join(' ');
  if (displayName) {
    await updateProfile(user, { displayName });
  }

  const idToken = await user.getIdToken();
  localStorage.setItem(TOKEN_KEY, idToken);
  localStorage.setItem(AUTH_MODE_KEY, 'firebase-direct');

  const authUser: AuthUser = {
    uid: user.uid,
    email: user.email || email,
    firebase_uid: user.uid,
    displayName: displayName || undefined,
  };
  localStorage.setItem(USER_KEY, JSON.stringify(authUser));

  return {
    idToken,
    localId: user.uid,
    email: user.email || email,
    authMode: 'firebase-direct',
    message: 'Inscription Firebase directe (backend indisponible)',
  };
}

/**
 * Register via le backend
 */
async function registerViaBackend(
  email: string,
  password: string,
  firstname?: string,
  lastname?: string,
): Promise<RegisterResponse> {
  const API_BASE = getBackendUrl();
  const response = await fetch(`${API_BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, firstname, lastname }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Erreur d'inscription" }));
    throw new Error(error.error || `Erreur ${response.status}`);
  }

  const data: RegisterResponse = await response.json();

  if (data.idToken) {
    localStorage.setItem(TOKEN_KEY, data.idToken);
  }
  localStorage.setItem(AUTH_MODE_KEY, 'backend');

  return data;
}

/**
 * Inscription hybride : backend d'abord, puis Firebase direct
 */
export async function register(
  email: string,
  password: string,
  firstname?: string,
  lastname?: string,
): Promise<RegisterResponse> {
  console.log('[Auth] Attempting hybrid register...');

  // 1. Essayer via le backend
  try {
    const backendReachable = await isBackendReachable();
    if (backendReachable) {
      return await registerViaBackend(email, password, firstname, lastname);
    }
  } catch (err: any) {
    console.warn('[Auth] Backend register failed:', err.message);
  }

  // 2. Fallback : Firebase direct
  try {
    return await registerFirebaseDirect(email, password, firstname, lastname);
  } catch (err: any) {
    console.error('[Auth] Firebase direct register failed:', err.message);
    const msg = translateFirebaseError(err.code || err.message);
    throw new Error(msg);
  }
}

/**
 * Déconnexion (local + Firebase)
 */
export async function logout(): Promise<void> {
  try {
    await firebaseSignOut(firebaseAuth);
  } catch {
    // Ignore Firebase signout errors
  }
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(AUTH_MODE_KEY);
}

/**
 * Récupère le token stocké.
 * Si connecté via Firebase direct, rafraîchit le token automatiquement.
 */
export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

/**
 * Rafraîchit le token Firebase si nécessaire
 */
export async function refreshToken(): Promise<string | null> {
  const mode = localStorage.getItem(AUTH_MODE_KEY);
  if (mode === 'firebase-direct' && firebaseAuth.currentUser) {
    try {
      const newToken = await firebaseAuth.currentUser.getIdToken(true);
      localStorage.setItem(TOKEN_KEY, newToken);
      return newToken;
    } catch {
      return localStorage.getItem(TOKEN_KEY);
    }
  }
  return localStorage.getItem(TOKEN_KEY);
}

/**
 * Récupère l'utilisateur connecté
 */
export function getCurrentUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Vérifie si l'utilisateur est connecté
 */
export function isAuthenticated(): boolean {
  return !!getAuthToken();
}

/**
 * Retourne le mode d'authentification actuel
 */
export function getAuthMode(): 'backend' | 'firebase-direct' | null {
  return localStorage.getItem(AUTH_MODE_KEY) as any;
}

/**
 * Vérifie le statut de l'API (mode auth actuel)
 */
export async function getAuthStatus(): Promise<{ authMode: string; online: boolean }> {
  try {
    const API_BASE = getBackendUrl();
    const response = await fetch(`${API_BASE}/api/auth/status`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) throw new Error(`Erreur ${response.status}`);
    return response.json();
  } catch {
    // Backend pas joignable → vérifier si Firebase est connecté
    const fbUser = firebaseAuth.currentUser;
    return {
      authMode: fbUser ? 'firebase-direct' : 'disconnected',
      online: !!fbUser,
    };
  }
}

/**
 * Force le rafraîchissement de la connectivité Firebase
 */
export async function refreshConnectivity(): Promise<{ authMode: string; online: boolean }> {
  try {
    const API_BASE = getBackendUrl();
    const response = await fetch(`${API_BASE}/api/auth/refresh-connectivity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) throw new Error(`Erreur ${response.status}`);
    return response.json();
  } catch {
    return {
      authMode: firebaseAuth.currentUser ? 'firebase-direct' : 'disconnected',
      online: !!firebaseAuth.currentUser,
    };
  }
}

/**
 * Vérifie si l'utilisateur actuel est anonyme
 */
export function isAnonymousUser(): boolean {
  return firebaseAuth.currentUser?.isAnonymous === true;
}

/**
 * Assure qu'un utilisateur Firebase est connecté.
 * Si aucun utilisateur n'est connecté, effectue un sign-in anonyme.
 * Retourne le token d'authentification.
 * 
 * IMPORTANT: Ne pas écraser une session backend valide avec un sign-in anonyme !
 */
export async function ensureAuthenticated(): Promise<string> {
  const existingToken = getAuthToken();
  const authMode = getAuthMode();

  // Si déjà connecté via backend avec un token valide, le retourner directement
  // Ne PAS faire de sign-in anonyme qui écraserait la session !
  if (existingToken && authMode === 'backend') {
    console.log('[Auth] Session backend valide, token existant utilisé');
    return existingToken;
  }

  // Si connecté via firebase-direct avec un currentUser, retourner le token
  if (existingToken && firebaseAuth.currentUser) {
    return existingToken;
  }

  // Si Firebase a un utilisateur mais pas de token local, rafraîchir
  if (firebaseAuth.currentUser) {
    try {
      const token = await firebaseAuth.currentUser.getIdToken(true);
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(AUTH_MODE_KEY, 'firebase-direct');
      const user: AuthUser = {
        uid: firebaseAuth.currentUser.uid,
        email: firebaseAuth.currentUser.email || 'anonyme',
      };
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      return token;
    } catch {
      // Continuer vers sign-in anonyme
    }
  }

  // Sign-in anonyme SEULEMENT si aucune session valide n'existe
  console.log('[Auth] Aucune session valide, sign-in anonyme...');
  try {
    const cred = await signInAnonymously(firebaseAuth);
    const token = await cred.user.getIdToken();
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(AUTH_MODE_KEY, 'firebase-direct');
    const user: AuthUser = {
      uid: cred.user.uid,
      email: 'anonyme',
      displayName: 'Visiteur',
    };
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    console.log('[Auth] Connecté anonymement, uid:', cred.user.uid);
    return token;
  } catch (err: any) {
    console.warn('[Auth] Sign-in anonyme échoué:', err.message);
    throw new Error('Impossible de s\'authentifier. Vérifiez votre connexion.');
  }
}

/**
 * Traduit les codes d'erreur Firebase en messages compréhensibles
 */
function translateFirebaseError(code: string): string {
  const errors: Record<string, string> = {
    'auth/invalid-email': 'Adresse email invalide',
    'auth/user-disabled': 'Ce compte a été désactivé',
    'auth/user-not-found': 'Aucun compte trouvé avec cet email',
    'auth/wrong-password': 'Mot de passe incorrect',
    'auth/email-already-in-use': 'Cet email est déjà utilisé',
    'auth/weak-password': 'Le mot de passe doit contenir au moins 6 caractères',
    'auth/too-many-requests': 'Trop de tentatives, veuillez réessayer plus tard',
    'auth/network-request-failed': 'Erreur réseau — vérifiez votre connexion internet',
    'auth/invalid-credential': 'Email ou mot de passe incorrect',
  };
  return errors[code] || `Erreur d'authentification: ${code}`;
}
