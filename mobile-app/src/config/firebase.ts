/**
 * Configuration Firebase côté client
 * Utilisé pour l'authentification, Firestore et Storage
 */
// @ts-ignore - Firebase types
import { initializeApp, FirebaseApp } from 'firebase/app';
// @ts-ignore - Firebase types
import { getAuth, Auth } from 'firebase/auth';
// @ts-ignore - Firebase types
import { getFirestore, Firestore, enableIndexedDbPersistence } from 'firebase/firestore';
// @ts-ignore - Firebase types
import { getStorage, FirebaseStorage } from 'firebase/storage';

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
let db: Firestore;
let storage: FirebaseStorage;

export function initFirebase(): { app: FirebaseApp; auth: Auth; db: Firestore; storage: FirebaseStorage } {
  if (!app) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);

    // Activer la persistence offline Firestore (IndexedDB)
    enableIndexedDbPersistence(db).catch((err: any) => {
      if (err.code === 'failed-precondition') {
        console.warn('[Firebase] Persistence offline échouée : plusieurs onglets ouverts');
      } else if (err.code === 'unimplemented') {
        console.warn('[Firebase] Persistence offline non supportée par ce navigateur');
      }
    });
  }
  return { app, auth, db, storage };
}

export function getFirebaseAuth(): Auth {
  if (!auth) {
    initFirebase();
  }
  return auth;
}

export function getFirebaseDb(): Firestore {
  if (!db) {
    initFirebase();
  }
  return db;
}

export function getFirebaseStorage(): FirebaseStorage {
  if (!storage) {
    initFirebase();
  }
  return storage;
}

export { app, auth, db, storage };
