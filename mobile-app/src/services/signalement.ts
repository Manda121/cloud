/**
 * Service de gestion des signalements - MODE HYBRIDE
 * 
 * Stratégie :
 * 1. Si le backend est disponible → appeler l'API identity-provider
 * 2. Si le backend est indisponible → stocker dans Firestore directement
 * 3. Toujours sauvegarder en local (localStorage) pour l'offline immédiat
 * 
 * Les signalements dans Firestore sont visibles par tous les appareils connectés.
 */

import { getAuthToken, getAuthMode, refreshToken } from './auth';
import { isBackendReachable, getBackendUrl } from './backend';
import { db } from './firebase';
import { auth as firebaseAuth } from './firebase';
import { savePhotos, getPhotosData, updatePhotosSignalementId } from './photoStorage';
import {
  collection,
  addDoc,
  getDocs,
  doc,
  getDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  GeoPoint,
  updateDoc,
  deleteDoc,
  Timestamp,
} from 'firebase/firestore';



export interface SignalementCreate {
  description: string;
  latitude: number;
  longitude: number;
  surface_m2?: number;
  budget?: number;
  prix_m2?: number;
  date_signalement?: string;
  source?: 'LOCAL' | 'FIREBASE';
  photos?: string[];
}

export interface Signalement {
  id_signalement: string;
  id_user: number;
  id_statut: number;
  id_entreprise?: number;
  description: string;
  surface_m2?: number;
  budget?: number;
  date_signalement: string;
  latitude: number;
  longitude: number;
  source: 'LOCAL' | 'FIREBASE';
  synced: boolean;
  created_at: string;
  // Métadonnée frontend (non stockée côté backend) pour une UX plus claire
  origin?: 'backend' | 'firestore';
}

/**
 * Récupère les headers d'authentification
 */
function getAuthHeaders(): HeadersInit {
  const token = getAuthToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}



// =====================================================
// FONCTIONS FIRESTORE (fallback quand backend indisponible)
// =====================================================

const FIRESTORE_COLLECTION = 'signalements';

/**
 * Crée un signalement dans Firestore
 */
async function createSignalementFirestore(data: SignalementCreate): Promise<Signalement> {
  // Tenter de s'authentifier (anonymement si nécessaire)
  const { ensureAuthenticated } = await import('./auth');
  try {
    await ensureAuthenticated();
  } catch {
    // Continuer même si l'auth échoue (mode offline)
  }

  const user = firebaseAuth.currentUser;
  const uid = user?.uid || 'offline-' + Date.now();
  const email = user?.email || 'anonyme';

  // Générer un ID pour le signalement avant création
  const tempId = `sig_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Sauvegarder les photos dans IndexedDB (compressées) au lieu de Firestore
  let photoIds: string[] = [];
  if (data.photos && data.photos.length > 0) {
    try {
      photoIds = await savePhotos(tempId, data.photos);
      console.log('[Signalement] Photos sauvegardées dans IndexedDB:', photoIds.length);
    } catch (err) {
      console.warn('[Signalement] Échec sauvegarde photos IndexedDB:', err);
    }
  }

  const docData = {
    uid: uid,
    email: email,
    description: data.description,
    latitude: data.latitude,
    longitude: data.longitude,
    location: new GeoPoint(data.latitude, data.longitude),
    surface_m2: data.surface_m2 ?? null,
    budget: data.budget ?? null,
    prix_m2: data.prix_m2 ?? null,
    date_signalement: data.date_signalement ?? new Date().toISOString().slice(0, 10),
    // Stocker uniquement les IDs des photos (pas les données base64)
    photo_ids: photoIds,
    photo_urls: [],
    photos: [], // Vide pour éviter la limite Firestore de 1MB
    source: 'FIREBASE' as const,
    synced: false, // pas encore synchronisé avec le backend
    id_statut: 1, // Nouveau
    created_at: serverTimestamp(),
  };

  const docRef = await addDoc(collection(db, FIRESTORE_COLLECTION), docData);
  console.log('[Signalement] Créé dans Firestore:', docRef.id);

  // Mettre à jour le signalement_id dans les photos stockées
  if (photoIds.length > 0) {
    try {
      await updatePhotosSignalementId(photoIds, docRef.id);
    } catch (err) {
      console.warn('[Signalement] Échec mise à jour photo IDs:', err);
    }
  }

  return {
    id_signalement: docRef.id,
    id_user: 0,
    id_statut: 1,
    description: data.description,
    latitude: data.latitude,
    longitude: data.longitude,
    surface_m2: data.surface_m2,
    budget: data.budget,
    date_signalement: data.date_signalement ?? new Date().toISOString().slice(0, 10),
    source: 'FIREBASE',
    synced: false,
    created_at: new Date().toISOString(),
    origin: 'firestore',
  };
}

/**
 * Récupère les signalements depuis Firestore
 */
async function getSignalementsFirestore(): Promise<Signalement[]> {
  const q = query(collection(db, FIRESTORE_COLLECTION), orderBy('created_at', 'desc'));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((docSnap) => {
    const d = docSnap.data();
    return {
      id_signalement: docSnap.id,
      id_user: 0,
      id_statut: d.id_statut ?? 1,
      description: d.description ?? '',
      latitude: d.latitude ?? d.location?.latitude ?? 0,
      longitude: d.longitude ?? d.location?.longitude ?? 0,
      surface_m2: d.surface_m2,
      budget: d.budget,
      date_signalement: d.date_signalement ?? '',
      source: 'FIREBASE' as const,
      synced: d.synced ?? false,
      created_at: d.created_at instanceof Timestamp
        ? d.created_at.toDate().toISOString()
        : d.created_at ?? new Date().toISOString(),
    };
  });
}

/**
 * Récupère un signalement par ID depuis Firestore
 */
async function getSignalementByIdFirestore(id: string): Promise<Signalement> {
  const docSnap = await getDoc(doc(db, FIRESTORE_COLLECTION, id));
  if (!docSnap.exists()) throw new Error('Signalement non trouvé');

  const d = docSnap.data();
  return {
    id_signalement: docSnap.id,
    id_user: 0,
    id_statut: d.id_statut ?? 1,
    description: d.description ?? '',
    latitude: d.latitude ?? d.location?.latitude ?? 0,
    longitude: d.longitude ?? d.location?.longitude ?? 0,
    surface_m2: d.surface_m2,
    budget: d.budget,
    date_signalement: d.date_signalement ?? '',
    source: 'FIREBASE' as const,
    synced: d.synced ?? false,
    created_at: d.created_at instanceof Timestamp
      ? d.created_at.toDate().toISOString()
      : d.created_at ?? new Date().toISOString(),
  };
}

// =====================================================
// FONCTIONS HYBRIDES (backend + Firestore fallback)
// =====================================================

/**
 * Crée un nouveau signalement via l'API
 */
export async function createSignalement(data: SignalementCreate): Promise<Signalement> {
  // Essayer le backend d'abord
  try {
    const reachable = await isBackendReachable();
    if (reachable) {
      const response = await fetch(`${getBackendUrl()}/api/signalements`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Erreur inconnue' }));
        throw new Error(error.error || `Erreur ${response.status}`);
      }

      const created = await response.json();
      // Annoter pour l'UX (sans dépendre du schéma backend exact)
      return { ...(created as any), origin: 'backend' } as Signalement;
    }
  } catch (err: any) {
    console.warn('[Signalement] Backend indisponible, fallback Firestore:', err.message);
  }

  // Fallback : Firestore
  return createSignalementFirestore(data);
}

/**
 * Récupère tous les signalements
 */
export async function getSignalements(): Promise<Signalement[]> {
  try {
    const reachable = await isBackendReachable();
    if (reachable) {
      const response = await fetch(`${getBackendUrl()}/api/signalements`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });

      if (!response.ok) throw new Error(`Erreur ${response.status}`);
      return response.json();
    }
  } catch (err: any) {
    console.warn('[Signalement] Backend indisponible pour GET, fallback Firestore:', err.message);
  }

  // Fallback : Firestore + local
  try {
    return await getSignalementsFirestore();
  } catch {
    // Dernier fallback : localStorage
    return getLocalSignalements();
  }
}

/**
 * Récupère un signalement par son ID
 */
export async function getSignalementById(id: string): Promise<Signalement> {
  try {
    const reachable = await isBackendReachable();
    if (reachable) {
      const response = await fetch(`${getBackendUrl()}/api/signalements/${encodeURIComponent(id)}`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });

      if (!response.ok) throw new Error(`Erreur ${response.status}`);
      return response.json();
    }
  } catch (err: any) {
    console.warn('[Signalement] Backend indisponible pour getById, fallback:', err.message);
  }

  // Fallback : Firestore
  try {
    return await getSignalementByIdFirestore(id);
  } catch {
    // Dernier fallback : localStorage
    const locals = getLocalSignalements();
    const found = locals.find((s: any) => s.id_signalement === id);
    if (found) return found;
    throw new Error('Signalement non trouvé');
  }
}

// Interface simple pour GeoJSON Feature Collection
interface FeatureCollection {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    properties: Record<string, unknown>;
    geometry: {
      type: string;
      coordinates: number[];
    };
  }>;
}

/**
 * Récupère les signalements au format GeoJSON (pour Leaflet)
 * Fallback : construit le GeoJSON depuis Firestore ou localStorage
 */
export async function getSignalementsGeoJSON(filters?: { userId?: number; statutId?: number }): Promise<FeatureCollection> {
  try {
    const reachable = await isBackendReachable();
    if (reachable) {
      const params = new URLSearchParams();
      if (filters?.userId) params.append('userId', String(filters.userId));
      if (filters?.statutId) params.append('statutId', String(filters.statutId));

      const url = `${getBackendUrl()}/api/signalements/geo/geojson${params.toString() ? '?' + params : ''}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: getAuthHeaders(),
      });

      if (!response.ok) throw new Error(`Erreur ${response.status}`);
      return response.json();
    }
  } catch (err: any) {
    console.warn('[Signalement] Backend GeoJSON indisponible, construction locale:', err.message);
  }

  // Fallback : construire GeoJSON depuis Firestore ou local
  let signalements: Signalement[];
  try {
    signalements = await getSignalementsFirestore();
  } catch {
    signalements = getLocalSignalements();
  }

  return {
    type: 'FeatureCollection',
    features: signalements.map((s) => ({
      type: 'Feature' as const,
      properties: {
        id_signalement: s.id_signalement,
        description: s.description,
        id_statut: s.id_statut,
        date_signalement: s.date_signalement,
        source: s.source,
        synced: s.synced,
      },
      geometry: {
        type: 'Point',
        coordinates: [s.longitude, s.latitude],
      },
    })),
  };
}

/**
 * Récupère les signalements dans une bounding box
 */
export async function getSignalementsInBbox(
  minLat: number,
  minLng: number,
  maxLat: number,
  maxLng: number
): Promise<Signalement[]> {
  const params = new URLSearchParams({
    minLat: String(minLat),
    minLng: String(minLng),
    maxLat: String(maxLat),
    maxLng: String(maxLng),
  });

  const response = await fetch(`${getBackendUrl()}/api/signalements/geo/bbox?${params}`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Erreur ${response.status}`);
  }

  return response.json();
}

/**
 * Récupère les signalements proches d'un point
 */
export async function getSignalementsNearby(
  lat: number,
  lng: number,
  radiusMeters: number = 1000
): Promise<(Signalement & { distance_meters: number })[]> {
  const params = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
    radius: String(radiusMeters),
  });

  const response = await fetch(`${getBackendUrl()}/api/signalements/geo/nearby?${params}`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Erreur ${response.status}`);
  }

  return response.json();
}

/**
 * Récupère les statistiques des signalements
 */
export async function getSignalementsStats(): Promise<{
  total: number;
  par_statut: { nouveau: number; en_cours: number; termine: number };
  surface_totale: number;
  budget_total: number;
  synchronisation: { synced: number; not_synced: number };
}> {
  const response = await fetch(`${getBackendUrl()}/api/signalements/stats`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Erreur ${response.status}`);
  }

  return response.json();
}

/**
 * Stockage local des signalements (pour mode offline)
 */
export function getLocalSignalements(): any[] {
  try {
    const raw = localStorage.getItem('signalements');
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.warn('Could not parse stored signalements', err);
    return [];
  }
}

export async function saveLocalSignalement(signalement: any): Promise<void> {
  const list = getLocalSignalements();

  // Si le signalement contient des photos (base64), les sauvegarder dans IndexedDB
  try {
    if (signalement.photos && Array.isArray(signalement.photos) && signalement.photos.length > 0) {
      const { savePhotos } = await import('./photoStorage');
      try {
        const photoIds = await savePhotos(signalement.id_signalement, signalement.photos);
        // Remplacer les données base64 par des références
        signalement.photo_ids = photoIds;
        delete signalement.photos;
        console.log('[Signalement] Photos locales déplacées vers IndexedDB, ids:', photoIds);
      } catch (err) {
        console.warn('[Signalement] Échec sauvegarde photos dans IndexedDB:', err);
        // Si échec, garder les photos en mémoire mais éviter planter l'enregistrement local
      }
    }
  } catch (err) {
    console.warn('[Signalement] Erreur lors du traitement des photos locales:', err);
  }

  list.push(signalement);

  try {
    localStorage.setItem('signalements', JSON.stringify(list));
  } catch (err: any) {
    // Gestion de l'erreur de quota : supprimer les champs lourds et retenter
    console.warn('[Signalement] Quota dépassé lors du saveLocalSignalement, tentative de fallback');
    for (const s of list) {
      if (s.photos) delete s.photos;
    }
    try {
      localStorage.setItem('signalements', JSON.stringify(list));
      console.log('[Signalement] Sauvegarde locale réussie après suppression des champs lourds');
    } catch (err2) {
      console.error('[Signalement] Sauvegarde locale échouée même après fallback:', err2);
    }
  }
}

export function updateLocalSignalement(id: string, updates: Partial<any>): void {
  const list = getLocalSignalements();
  const idx = list.findIndex((s: any) => s.id_signalement === id);
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...updates };
    localStorage.setItem('signalements', JSON.stringify(list));
  }
}
