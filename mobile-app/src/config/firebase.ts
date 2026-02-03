/**
 * Configuration Firebase côté client
 * Utilisé pour l'authentification directe (sans passer par le backend local)
 */
// @ts-ignore - Firebase types
import { initializeApp, FirebaseApp } from 'firebase/app';
// @ts-ignore - Firebase types
import { getAuth, Auth } from 'firebase/auth';

// Config Firebase - récupérée depuis la console Firebase > Project Settings > General
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyBm-aD-xNstMvirSrHO0vyEQGwia8J-zFk',
  authDomain: 'fir-authentification-978a0.firebaseapp.com',
  projectId: 'fir-authentification-978a0',
  storageBucket: 'fir-authentification-978a0.firebasestorage.app',
  messagingSenderId: '114320752404512342329',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};

// Initialize Firebase
let app: FirebaseApp;
let auth: Auth;

export function initFirebase(): { app: FirebaseApp; auth: Auth } {
  if (!app) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
  }
  return { app, auth };
}

export function getFirebaseAuth(): Auth {
  if (!auth) {
    initFirebase();
  }
  return auth;
}

export { app, auth };
