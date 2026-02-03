/**
 * Service d'authentification
 * Connexion directe via Firebase Auth
 */

// @ts-ignore - Firebase types
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirebaseAuth } from '../config/firebase';

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

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
 * Connexion directe via Firebase Auth
 */
export async function login(email: string, password: string): Promise<LoginResponse> {
  try {
    const auth = getFirebaseAuth();
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
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
      token: idToken,
      uid: user.uid,
      email: user.email || email,
      authMode: 'firebase',
      message: 'Connexion Firebase réussie',
    };
  } catch (error: any) {
    // Traduire les erreurs Firebase en français
    const errorCode = error?.code || '';
    let message = error?.message || 'Erreur de connexion';
    
    if (errorCode === 'auth/user-not-found') {
      message = 'Utilisateur non trouvé';
    } else if (errorCode === 'auth/wrong-password') {
      message = 'Mot de passe incorrect';
    } else if (errorCode === 'auth/invalid-email') {
      message = 'Adresse email invalide';
    } else if (errorCode === 'auth/invalid-credential') {
      message = 'Email ou mot de passe incorrect';
    } else if (errorCode === 'auth/too-many-requests') {
      message = 'Trop de tentatives. Réessayez plus tard.';
    }
    
    throw new Error(message);
  }
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
    const auth = getFirebaseAuth();
    const user = auth.currentUser;
    if (user) {
      const newToken = await user.getIdToken(true);
      localStorage.setItem(TOKEN_KEY, newToken);
      return newToken;
    }
    return null;
  } catch (e) {
    return null;
  }
}
