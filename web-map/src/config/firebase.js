// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { 
  getFirestore,
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where,
  setDoc 
} from "firebase/firestore";

// Firebase configuration - même projet que le mobile-app (miranto-mobile)
const firebaseConfig = {
  apiKey: "AIzaSyDSanU3YjNWDby7zWphZZW2O8f2nBxF67Y",
  authDomain: "miranto-mobile.firebaseapp.com",
  projectId: "miranto-mobile",
  storageBucket: "miranto-mobile.firebasestorage.app",
  messagingSenderId: "561744947732",
  appId: "1:561744947732:web:d2bb551e7c825f2fb15501"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore - base de données par défaut (même que mobile-app)
const db = getFirestore(app);

// Collection de signalements
const SIGNALEMENTS_COLLECTION = 'signalements';

// Export des fonctions Firestore
export { 
  db, 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where,
  setDoc,
  SIGNALEMENTS_COLLECTION 
};

export default app;