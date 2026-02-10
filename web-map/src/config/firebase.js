// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { 
  initializeFirestore,
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

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDJQ_YkUxSUdeHNJb--hQFSnLuu2F_qoOc",
  authDomain: "base-tp-cloud.firebaseapp.com",
  projectId: "base-tp-cloud",
  storageBucket: "base-tp-cloud.firebasestorage.app",
  messagingSenderId: "369648817817",
  appId: "1:369648817817:web:3c3072369fa6b94dd94a08"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore avec la base de données "tp-cloud"
const db = initializeFirestore(app, {}, 'tp-cloud');

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