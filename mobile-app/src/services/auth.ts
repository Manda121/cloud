/**
 * Service d'authentification
 * Connexion directe via Firebase Auth
 */

// @ts-ignore - Firebase types
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, signInWithCustomToken } from 'firebase/auth';
import { getFirebaseAuth } from '../config/firebase';

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';
const FIREBASE_TOKEN_KEY = 'firebase_token';

export interface AuthUser {
  id?: number;
  uid?: string;
  email: string;
  firebase_uid?: string;
}

export interface LoginResponse {
  token: string;
  user?: AuthUser;
  uid?: string;
  email?: string;
  authMode: 'local' | 'firebase';
  customToken?: string;
  message?: string;
}

export interface RegisterResponse {
  idToken?: string;
  localId?: string;
  email?: string;
  authMode: 'local' | 'firebase';
  message?: string;
  // local mode fields
  id?: number;
}

/**
 * Connexion via le backend (sécurisé) - retourne également un customToken Firebase
 */
export async function login(email: string, password: string): Promise<LoginResponse> {
  const API_BASE = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:3000';

  const response = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Erreur inconnue' }));
    throw new Error(err.error || `Erreur ${response.status}`);
  }

  const data = await response.json();

  // Stocker le token backend (JWT ou idToken selon mode)
  if (data.token) localStorage.setItem(TOKEN_KEY, data.token);

  // Stocker les infos utilisateur
  const authUser: AuthUser = { uid: data.uid, email: data.email, firebase_uid: data.uid };
  localStorage.setItem(USER_KEY, JSON.stringify(authUser));

  // Si le backend a généré un customToken, se connecter au SDK Firebase coté client
  if (data.customToken) {
    try {
      const auth = getFirebaseAuth();
      await signInWithCustomToken(auth, data.customToken);
      const currentUser = auth.currentUser;
      const idToken = currentUser ? await currentUser.getIdToken() : null;
      if (idToken) localStorage.setItem(FIREBASE_TOKEN_KEY, idToken);
    } catch (e: any) {
      console.warn('[Auth] Firebase signInWithCustomToken failed:', e.message || e);
      // ne bloque pas la connexion backend - on renvoie quand même la réponse
    }
  }

  return {
    token: data.token,
    uid: data.uid,
    email: data.email,
    authMode: data.authMode,
    customToken: data.customToken,
    message: data.message,
  };
}

/**
 * Inscription directe via Firebase Auth
 */
export async function register(
  email: string,
  password: string,
  _firstname?: string,
  _lastname?: string
): Promise<RegisterResponse> {
  try {
    const auth = getFirebaseAuth();
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Récupérer le token Firebase
    const idToken = await user.getIdToken();
    
    // Stocker le token
    localStorage.setItem(TOKEN_KEY, idToken);
    
    // Stocker les infos utilisateur
    const authUser: AuthUser = {
      uid: user.uid,
      email: user.email || email,
      firebase_uid: user.uid,
    };
    localStorage.setItem(USER_KEY, JSON.stringify(authUser));
    
    return {
      idToken,
      localId: user.uid,
      email: user.email || email,
      authMode: 'firebase',
      message: 'Inscription Firebase réussie',
    };
  } catch (error: any) {
    const errorCode = error?.code || '';
    let message = error?.message || 'Erreur d\'inscription';
    
    if (errorCode === 'auth/email-already-in-use') {
      message = 'Cette adresse email est déjà utilisée';
    } else if (errorCode === 'auth/weak-password') {
      message = 'Le mot de passe doit contenir au moins 6 caractères';
    } else if (errorCode === 'auth/invalid-email') {
      message = 'Adresse email invalide';
    }
    
    throw new Error(message);
  }
}

/**
 * Déconnexion (Firebase + localStorage)
 */
export async function logout(): Promise<void> {
  try {
    const auth = getFirebaseAuth();
    await signOut(auth);
  } catch (e) {
    // Ignorer les erreurs de signOut
  }
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

/**
 * Récupère le token stocké
 */
export function getAuthToken(): string | null {
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
 * Vérifie le statut de l'auth (toujours Firebase en mode direct)
 */
export async function getAuthStatus(): Promise<{ authMode: string; online: boolean }> {
  return { authMode: 'firebase', online: true };
}

/**
 * Rafraîchir le token Firebase si nécessaire
 */
export async function refreshToken(): Promise<string | null> {
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
    // IMPORTANT:
    // Même en mode backend, Firestore exige une session Firebase (request.auth).
    // On s'assure donc d'avoir un utilisateur Firebase (anonyme) en parallèle,
    // sans toucher au token backend stocké.
    if (!firebaseAuth.currentUser) {
      try {
        const cred = await signInAnonymously(firebaseAuth);
        console.log('[Auth] Session backend + Firebase anonyme active, uid:', cred.user.uid);
      } catch (err: any) {
        console.warn('[Auth] Firebase anonyme indisponible (mode backend):', err?.message ?? err);
      }
    }

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
    return null;
  } catch (e) {
    return null;
  }
}
