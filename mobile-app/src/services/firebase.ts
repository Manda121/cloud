/**
 * Configuration Firebase côté client (mobile/web)
 * Permet l'authentification directe avec Firebase sans passer par le backend
 * et le stockage des signalements dans Firestore
 */

import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';

// Configuration Firebase - récupérée depuis les variables d'environnement
// Ces valeurs sont publiques (côté client) et sont sécurisées par les Firebase Security Rules
const firebaseConfig = {
  apiKey: (import.meta as any).env?.VITE_FIREBASE_API_KEY ?? '',
  authDomain: (import.meta as any).env?.VITE_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: (import.meta as any).env?.VITE_FIREBASE_PROJECT_ID ?? 'miranto-mobile',
  storageBucket: (import.meta as any).env?.VITE_FIREBASE_STORAGE_BUCKET ?? '',
  messagingSenderId: (import.meta as any).env?.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: (import.meta as any).env?.VITE_FIREBASE_APP_ID ?? '',
};

console.log('[Firebase Client] Initializing with project:', firebaseConfig.projectId);

// Initialiser Firebase
const app = initializeApp(firebaseConfig);

// Initialiser les services
export const auth = getAuth(app);
export const db = getFirestore(app);

// Pour le développement local avec émulateurs Firebase (optionnel)
const useEmulators = (import.meta as any).env?.VITE_USE_FIREBASE_EMULATORS === 'true';
if (useEmulators) {
  connectAuthEmulator(auth, 'http://localhost:9099');
  connectFirestoreEmulator(db, 'localhost', 8080);
  console.log('[Firebase Client] Connected to local emulators');
}

export default app;
