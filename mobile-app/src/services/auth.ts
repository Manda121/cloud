/**
 * Service d'authentification
 * Appelle l'API identity-provider et stocke le token
 */

const API_BASE = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:3000';
const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

console.log('[Auth Service] API_BASE:', API_BASE);

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
 * Connexion via l'API
 */
export async function login(email: string, password: string): Promise<LoginResponse> {
  const url = `${API_BASE}/api/auth/login`;
  console.log('[Auth] Attempting login to:', url);
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    console.log('[Auth] Response status:', response.status);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Erreur de connexion' }));
      throw new Error(error.error || `Erreur ${response.status}`);
    }

    const data: LoginResponse = await response.json();

    // Stocker le token
    if (data.token) {
      localStorage.setItem(TOKEN_KEY, data.token);
    }

    // Stocker les infos utilisateur
    const user: AuthUser = data.user || {
      uid: data.uid,
      email: data.email || email,
    };
    localStorage.setItem(USER_KEY, JSON.stringify(user));

    return data;
  } catch (err: any) {
    console.error('[Auth] Login error:', err.message, err);
    throw new Error(err.message || 'Failed to fetch');
  }
}

/**
 * Inscription via l'API
 */
export async function register(
  email: string,
  password: string,
  firstname?: string,
  lastname?: string
): Promise<RegisterResponse> {
  const response = await fetch(`${API_BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, firstname, lastname }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erreur d\'inscription' }));
    throw new Error(error.error || `Erreur ${response.status}`);
  }

  const data: RegisterResponse = await response.json();

  // Si on reçoit un idToken (Firebase), le stocker
  if (data.idToken) {
    localStorage.setItem(TOKEN_KEY, data.idToken);
  }

  return data;
}

/**
 * Déconnexion
 */
export function logout(): void {
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
 * Vérifie le statut de l'API (mode auth actuel)
 */
export async function getAuthStatus(): Promise<{ authMode: string; online: boolean }> {
  const response = await fetch(`${API_BASE}/api/auth/status`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Erreur ${response.status}`);
  }

  return response.json();
}

/**
 * Force le rafraîchissement de la connectivité Firebase
 */
export async function refreshConnectivity(): Promise<{ authMode: string; online: boolean }> {
  const response = await fetch(`${API_BASE}/api/auth/refresh-connectivity`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Erreur ${response.status}`);
  }

  return response.json();
}
