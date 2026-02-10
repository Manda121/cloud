/**
 * Service Firestore pour les signalements
 * Gère les opérations CRUD avec Firebase Firestore
 */

import { 
  db, 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  setDoc,
  SIGNALEMENTS_COLLECTION 
} from '../config/firebase';

/**
 * Vérifie si l'utilisateur est en ligne
 */
const isOnline = () => {
  return navigator.onLine;
};

/**
 * Convertit un signalement local en format Firestore
 */
const toFirestoreFormat = (signalement) => {
  return {
    id_local: signalement.id_signalement || null,
    uid: signalement.uid || signalement.id_user || null,
    id_user: signalement.id_user || null,
    id_statut: signalement.id_statut || 1,
    id_entreprise: signalement.id_entreprise || null,
    description: signalement.description || '',
    surface_m2: signalement.surface_m2 ? parseFloat(signalement.surface_m2) : null,
    budget: signalement.budget ? parseFloat(signalement.budget) : null,
    date_signalement: signalement.date_signalement || new Date().toISOString().split('T')[0],
    longitude: signalement.longitude || (signalement.geom?.coordinates?.[0]) || null,
    latitude: signalement.latitude || (signalement.geom?.coordinates?.[1]) || null,
    source: signalement.source || 'FIREBASE',
    synced: true,
    created_at: signalement.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
};

/**
 * Convertit un document Firestore en format local
 * Gère les données venant du mobile-app (uid, location GeoPoint) et du web-map
 */
const fromFirestoreFormat = (docSnapshot) => {
  const data = docSnapshot.data();

  // Résoudre les coordonnées (le mobile utilise un GeoPoint 'location' ou latitude/longitude)
  let lng = data.longitude || null;
  let lat = data.latitude || null;
  if (data.location && typeof data.location.latitude === 'number') {
    lat = data.location.latitude;
    lng = data.location.longitude;
  }

  // Résoudre l'identifiant utilisateur (mobile = uid, web = id_user)
  const uid = data.uid || data.id_user || null;

  return {
    id_firestore: docSnapshot.id,
    id_user: uid,
    uid: uid,
    id_statut: data.id_statut || data.statut || 1,
    id_entreprise: data.id_entreprise || null,
    description: data.description || '',
    surface_m2: data.surface_m2 || null,
    budget: data.budget || null,
    date_signalement: data.date_signalement || null,
    longitude: lng,
    latitude: lat,
    geom: lng && lat ? { coordinates: [lng, lat] } : null,
    source: 'FIREBASE',
    synced: true,
    created_at: data.created_at || null,
    updated_at: data.updated_at || null
  };
};

const firestoreService = {
  /**
   * Récupère tous les signalements depuis Firestore
   */
  getAll: async () => {
    if (!isOnline()) {
      console.log('[Firestore] Mode hors ligne - impossible de récupérer les données');
      return [];
    }

    try {
      console.log('[Firestore] Tentative de connexion à la collection:', SIGNALEMENTS_COLLECTION);
      console.log('[Firestore] Base de données:', db ? 'Initialisée' : 'Non initialisée');
      
      const collectionRef = collection(db, SIGNALEMENTS_COLLECTION);
      console.log('[Firestore] Référence collection créée, exécution de la requête...');
      
      const querySnapshot = await getDocs(collectionRef);
      console.log('[Firestore] Requête terminée, nombre de docs:', querySnapshot.size);
      
      const signalements = [];
      querySnapshot.forEach((doc) => {
        console.log('[Firestore] Document trouvé:', doc.id, doc.data());
        signalements.push(fromFirestoreFormat(doc));
      });
      console.log(`[Firestore] ${signalements.length} signalements récupérés`);
      return signalements;
    } catch (error) {
      console.error('[Firestore] Erreur getAll:', error);
      console.error('[Firestore] Code erreur:', error.code);
      console.error('[Firestore] Message:', error.message);
      return [];
    }
  },

  /**
   * Récupère un signalement par son ID Firestore
   */
  getById: async (firestoreId) => {
    if (!isOnline()) {
      return null;
    }

    try {
      const docRef = doc(db, SIGNALEMENTS_COLLECTION, firestoreId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return fromFirestoreFormat(docSnap);
      }
      return null;
    } catch (error) {
      console.error('[Firestore] Erreur getById:', error.message);
      return null;
    }
  },

  /**
   * Cherche un signalement par son ID local
   */
  findByLocalId: async (localId) => {
    if (!isOnline()) {
      return null;
    }

    try {
      const querySnapshot = await getDocs(collection(db, SIGNALEMENTS_COLLECTION));
      let found = null;
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.id_local === localId) {
          found = { firestoreId: docSnap.id, ...fromFirestoreFormat(docSnap) };
        }
      });
      return found;
    } catch (error) {
      console.error('[Firestore] Erreur findByLocalId:', error.message);
      return null;
    }
  },

  /**
   * Crée un nouveau signalement dans Firestore
   */
  create: async (signalement) => {
    if (!isOnline()) {
      console.log('[Firestore] Mode hors ligne - signalement non créé dans Firestore');
      return null;
    }

    try {
      console.log('[Firestore] Création signalement, données reçues:', signalement);
      const firestoreData = toFirestoreFormat(signalement);
      console.log('[Firestore] Données formatées pour Firestore:', firestoreData);
      
      const collectionRef = collection(db, SIGNALEMENTS_COLLECTION);
      console.log('[Firestore] Envoi vers collection:', SIGNALEMENTS_COLLECTION);
      
      const docRef = await addDoc(collectionRef, firestoreData);
      console.log('[Firestore] ✅ Signalement créé avec succès, ID:', docRef.id);
      return { id: docRef.id, ...firestoreData };
    } catch (error) {
      console.error('[Firestore] ❌ Erreur create:', error);
      console.error('[Firestore] Code erreur:', error.code);
      console.error('[Firestore] Message:', error.message);
      throw error;
    }
  },

  /**
   * Crée ou met à jour un signalement avec un ID spécifique
   */
  createWithId: async (firestoreId, signalement) => {
    if (!isOnline()) {
      return null;
    }

    try {
      const firestoreData = toFirestoreFormat(signalement);
      await setDoc(doc(db, SIGNALEMENTS_COLLECTION, firestoreId), firestoreData);
      console.log('[Firestore] Signalement créé/mis à jour avec ID:', firestoreId);
      return { id: firestoreId, ...firestoreData };
    } catch (error) {
      console.error('[Firestore] Erreur createWithId:', error.message);
      throw error;
    }
  },

  /**
   * Met à jour un signalement dans Firestore
   */
  update: async (firestoreId, data) => {
    if (!isOnline()) {
      console.log('[Firestore] Mode hors ligne - signalement non mis à jour dans Firestore');
      return null;
    }

    try {
      const docRef = doc(db, SIGNALEMENTS_COLLECTION, firestoreId);
      const updateData = {
        ...data,
        updated_at: new Date().toISOString()
      };
      await updateDoc(docRef, updateData);
      console.log('[Firestore] Signalement mis à jour:', firestoreId);
      return { id: firestoreId, ...updateData };
    } catch (error) {
      console.error('[Firestore] Erreur update:', error.message);
      throw error;
    }
  },

  /**
   * Met à jour un signalement par son ID local
   */
  updateByLocalId: async (localId, data) => {
    if (!isOnline()) {
      return null;
    }

    try {
      const existing = await firestoreService.findByLocalId(localId);
      if (existing && existing.firestoreId) {
        return await firestoreService.update(existing.firestoreId, data);
      }
      return null;
    } catch (error) {
      console.error('[Firestore] Erreur updateByLocalId:', error.message);
      throw error;
    }
  },

  /**
   * Supprime un signalement de Firestore
   */
  delete: async (firestoreId) => {
    if (!isOnline()) {
      console.log('[Firestore] Mode hors ligne - signalement non supprimé de Firestore');
      return false;
    }

    try {
      await deleteDoc(doc(db, SIGNALEMENTS_COLLECTION, firestoreId));
      console.log('[Firestore] Signalement supprimé:', firestoreId);
      return true;
    } catch (error) {
      console.error('[Firestore] Erreur delete:', error.message);
      throw error;
    }
  },

  /**
   * Supprime un signalement par son ID local
   */
  deleteByLocalId: async (localId) => {
    if (!isOnline()) {
      return false;
    }

    try {
      const existing = await firestoreService.findByLocalId(localId);
      if (existing && existing.firestoreId) {
        return await firestoreService.delete(existing.firestoreId);
      }
      return false;
    } catch (error) {
      console.error('[Firestore] Erreur deleteByLocalId:', error.message);
      throw error;
    }
  },

  /**
   * Vérifie si on est en ligne
   */
  isOnline,

  /**
   * Utilitaires de conversion
   */
  toFirestoreFormat,
  fromFirestoreFormat
};

export default firestoreService;
