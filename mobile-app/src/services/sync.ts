/**
 * Service de synchronisation pour l'application mobile
 * Gère la synchronisation bidirectionnelle avec le backend ET Firebase directement
 */

import { getAuthToken, getCurrentUser } from './auth';
import { getFirebaseDb } from '../config/firebase';
// @ts-ignore - Firebase types
import {
  collection, doc, setDoc, getDocs, query, where, onSnapshot,
  serverTimestamp, Timestamp, Unsubscribe
} from 'firebase/firestore';
import { syncAllPhotos, getPhotosForSignalement } from './photo';
import { getLocalSignalements, saveLocalSignalement, updateLocalSignalement } from './signalement';

const API_BASE = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:3000';

// ============================================
// TYPES
// ============================================

export interface SyncResult {
  success: boolean;
  message: string;
  data: {
    created?: string[];
    updated?: string[];
    conflicts?: SyncConflict[];
    skipped?: string[];
    success?: string[];
    failed?: Array<{ id_signalement: string; error: string }>;
  };
}

export interface SyncConflict {
  id: number;
  id_signalement: string;
  conflict_type: string;
  local_data: Record<string, unknown>;
  firebase_data: Record<string, unknown>;
  resolved: boolean;
  created_at: string;
}

export interface SyncStats {
  total_events: number;
  success_count: number;
  error_count: number;
  last_sync: string | null;
  synced_signalements: number;
  unsynced_signalements: number;
  pending_conflicts: number;
}

export interface SyncLog {
  id: number;
  event_type: string;
  status: 'SUCCESS' | 'ERROR' | 'PARTIAL_ERROR' | 'COMPLETED';
  details: Record<string, unknown>;
  created_at: string;
}

// ============================================
// HELPERS
// ============================================

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

// ============================================
// API CALLS
// ============================================

/**
 * Tirer les données depuis Firebase vers le backend local
 */
export async function pullFromFirebase(): Promise<SyncResult> {
  const response = await fetch(`${API_BASE}/api/sync/pull`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erreur inconnue' }));
    throw new Error(error.error || `Erreur ${response.status}`);
  }

  return response.json();
}

/**
 * Pousser les données locales vers Firebase
 */
export async function pushToFirebase(): Promise<SyncResult> {
  const response = await fetch(`${API_BASE}/api/sync/push`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erreur inconnue' }));
    throw new Error(error.error || `Erreur ${response.status}`);
  }

  return response.json();
}

/**
 * Déclencher une synchronisation manuelle
 * @param direction - 'pull', 'push' ou 'both'
 */
export async function triggerSync(direction: 'pull' | 'push' | 'both' = 'both'): Promise<SyncResult> {
  const response = await fetch(`${API_BASE}/api/sync/trigger`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ direction }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erreur inconnue' }));
    throw new Error(error.error || `Erreur ${response.status}`);
  }

  return response.json();
}

/**
 * Récupérer les conflits en attente de résolution
 */
export async function getConflicts(): Promise<{ count: number; data: SyncConflict[] }> {
  const response = await fetch(`${API_BASE}/api/sync/conflicts`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Erreur ${response.status}`);
  }

  return response.json();
}

/**
 * Résoudre un conflit de synchronisation
 * @param id - ID du signalement en conflit
 * @param resolution - 'LOCAL' ou 'FIREBASE'
 */
export async function resolveConflict(
  id: string,
  resolution: 'LOCAL' | 'FIREBASE'
): Promise<{ success: boolean; id_signalement: string; resolution: string }> {
  const response = await fetch(`${API_BASE}/api/sync/conflicts/${encodeURIComponent(id)}/resolve`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ resolution }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erreur inconnue' }));
    throw new Error(error.error || `Erreur ${response.status}`);
  }

  return response.json();
}

/**
 * Récupérer l'historique des synchronisations
 */
export async function getSyncHistory(limit: number = 50): Promise<{ count: number; data: SyncLog[] }> {
  const response = await fetch(`${API_BASE}/api/sync/history?limit=${limit}`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Erreur ${response.status}`);
  }

  return response.json();
}

/**
 * Récupérer les erreurs de synchronisation récentes
 */
export async function getSyncErrors(limit: number = 20): Promise<{ count: number; data: SyncLog[] }> {
  const response = await fetch(`${API_BASE}/api/sync/errors?limit=${limit}`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Erreur ${response.status}`);
  }

  return response.json();
}

/**
 * Récupérer les statistiques de synchronisation
 */
export async function getSyncStats(): Promise<{ success: boolean; data: SyncStats }> {
  const response = await fetch(`${API_BASE}/api/sync/stats`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Erreur ${response.status}`);
  }

  return response.json();
}

// ============================================
// GESTION LOCALE DE LA SYNC
// ============================================

const LAST_SYNC_KEY = 'last_sync_timestamp';
const SYNC_QUEUE_KEY = 'sync_queue';

/**
 * Récupérer la date de dernière synchronisation
 */
export function getLastSyncTime(): Date | null {
  const stored = localStorage.getItem(LAST_SYNC_KEY);
  return stored ? new Date(stored) : null;
}

/**
 * Enregistrer la date de dernière synchronisation
 */
export function setLastSyncTime(date: Date = new Date()): void {
  localStorage.setItem(LAST_SYNC_KEY, date.toISOString());
}

/**
 * Ajouter une action à la queue de synchronisation (pour mode offline)
 */
export function addToSyncQueue(action: {
  type: 'CREATE' | 'UPDATE' | 'DELETE';
  entity: string;
  data: Record<string, unknown>;
}): void {
  const queue = getSyncQueue();
  queue.push({
    ...action,
    timestamp: new Date().toISOString(),
    id: crypto.randomUUID(),
  });
  localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
}

/**
 * Récupérer la queue de synchronisation
 */
export function getSyncQueue(): Array<{
  id: string;
  type: string;
  entity: string;
  data: Record<string, unknown>;
  timestamp: string;
}> {
  try {
    const raw = localStorage.getItem(SYNC_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Vider la queue de synchronisation
 */
export function clearSyncQueue(): void {
  localStorage.removeItem(SYNC_QUEUE_KEY);
}

/**
 * Supprimer un élément de la queue de synchronisation
 */
export function removeFromSyncQueue(id: string): void {
  const queue = getSyncQueue();
  const filtered = queue.filter(item => item.id !== id);
  localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(filtered));
}

// ============================================
// AUTO-SYNC
// ============================================

let autoSyncInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Démarrer la synchronisation automatique
 * @param intervalMs - Intervalle en millisecondes (défaut: 5 minutes)
 */
export function startAutoSync(intervalMs: number = 5 * 60 * 1000): void {
  if (autoSyncInterval) {
    clearInterval(autoSyncInterval);
  }

  autoSyncInterval = setInterval(async () => {
    try {
      console.log('[Sync] Auto-sync triggered');
      
      // Vérifier si on est en ligne
      if (!navigator.onLine) {
        console.log('[Sync] Offline - skipping auto-sync');
        return;
      }

      // Lancer la synchronisation bidirectionnelle
      const result = await triggerSync('both');
      console.log('[Sync] Auto-sync completed:', result);
      
      setLastSyncTime();
    } catch (error) {
      console.error('[Sync] Auto-sync error:', error);
    }
  }, intervalMs);

  console.log(`[Sync] Auto-sync started (interval: ${intervalMs}ms)`);
}

/**
 * Arrêter la synchronisation automatique
 */
export function stopAutoSync(): void {
  if (autoSyncInterval) {
    clearInterval(autoSyncInterval);
    autoSyncInterval = null;
    console.log('[Sync] Auto-sync stopped');
  }
}

/**
 * Vérifier si la synchronisation automatique est active
 */
export function isAutoSyncRunning(): boolean {
  return autoSyncInterval !== null;
}

// ============================================
// SYNCHRONISATION DIRECTE FIREBASE (FIRESTORE)
// ============================================

/**
 * Pousse les signalements locaux non-synchronisés vers Firestore directement
 * (sans passer par le backend — utile en mode offline pur)
 */
export async function pushLocalToFirestore(): Promise<{
  pushed: string[];
  failed: Array<{ id: string; error: string }>;
}> {
  const db = getFirebaseDb();
  const user = getCurrentUser();
  const uid = user?.uid || user?.firebase_uid || 'anonymous';
  const localSignalements = getLocalSignalements();
  const unsynced = localSignalements.filter((s: any) => !s.synced);

  const results = { pushed: [] as string[], failed: [] as Array<{ id: string; error: string }> };

  for (const sig of unsynced) {
    try {
      // Récupérer les photos associées
      const photos = getPhotosForSignalement(sig.id_signalement);
      const photoUrls = photos
        .filter((p) => p.firebaseUrl)
        .map((p) => p.firebaseUrl);

      const docRef = doc(collection(db, 'signalements'), sig.id_signalement);
      await setDoc(docRef, {
        id_signalement: sig.id_signalement,
        description: sig.description || '',
        surface_m2: sig.surface_m2 || null,
        budget: sig.budget || null,
        date_signalement: sig.date_signalement || null,
        latitude: sig.latitude ?? sig.geom?.coordinates?.[1] ?? null,
        longitude: sig.longitude ?? sig.geom?.coordinates?.[0] ?? null,
        source: sig.source || 'LOCAL',
        photos: photoUrls,
        owner_uid: uid,
        synced_from_mobile: true,
        created_at: sig.created_at || new Date().toISOString(),
        updated_at: serverTimestamp(),
      }, { merge: true });

      // Marquer comme synchronisé localement
      updateLocalSignalement(sig.id_signalement, { synced: true });
      results.pushed.push(sig.id_signalement);
    } catch (error: any) {
      console.error(`[Sync] Firestore push failed for ${sig.id_signalement}:`, error);
      results.failed.push({ id: sig.id_signalement, error: error.message });
    }
  }

  console.log(`[Sync] Firestore push: ${results.pushed.length} OK, ${results.failed.length} failed`);
  return results;
}

/**
 * Tire les signalements depuis Firestore vers le stockage local
 */
export async function pullFromFirestore(): Promise<{
  received: string[];
  errors: string[];
}> {
  const db = getFirebaseDb();
  const results = { received: [] as string[], errors: [] as string[] };

  try {
    const snap = await getDocs(collection(db, 'signalements'));

    snap.forEach((docSnap) => {
      try {
        const data = docSnap.data();
        const localSignalements = getLocalSignalements();
        const exists = localSignalements.find((s: any) => s.id_signalement === docSnap.id);

        if (!exists) {
          // Nouveau signalement provenant d'un autre appareil
          saveLocalSignalement({
            id_signalement: docSnap.id,
            description: data.description,
            surface_m2: data.surface_m2,
            budget: data.budget,
            date_signalement: data.date_signalement,
            latitude: data.latitude,
            longitude: data.longitude,
            geom: data.latitude && data.longitude
              ? { type: 'Point', coordinates: [data.longitude, data.latitude] }
              : null,
            source: 'FIREBASE',
            synced: true,
            photos: data.photos || [],
            created_at: data.created_at || new Date().toISOString(),
          });
          results.received.push(docSnap.id);
        }
      } catch (e: any) {
        results.errors.push(docSnap.id);
      }
    });
  } catch (error: any) {
    console.error('[Sync] Firestore pull failed:', error);
    throw error;
  }

  console.log(`[Sync] Firestore pull: ${results.received.length} received`);
  return results;
}

// ============================================
// ÉCOUTE TEMPS RÉEL (onSnapshot)
// ============================================

let realtimeUnsubscribe: Unsubscribe | null = null;

/**
 * Active l'écoute temps réel des signalements Firestore
 * Appelle le callback à chaque changement
 */
export function startRealtimeSync(
  onUpdate: (changes: Array<{ type: string; id: string; data: any }>) => void
): void {
  if (realtimeUnsubscribe) {
    realtimeUnsubscribe();
  }

  const db = getFirebaseDb();
  const colRef = collection(db, 'signalements');

  realtimeUnsubscribe = onSnapshot(colRef, (snapshot) => {
    const changes: Array<{ type: string; id: string; data: any }> = [];

    snapshot.docChanges().forEach((change) => {
      changes.push({
        type: change.type, // 'added' | 'modified' | 'removed'
        id: change.doc.id,
        data: change.doc.data(),
      });
    });

    if (changes.length > 0) {
      console.log(`[Sync] Realtime: ${changes.length} changements reçus`);
      onUpdate(changes);
    }
  }, (error) => {
    console.error('[Sync] Realtime listener error:', error);
  });

  console.log('[Sync] Realtime sync started');
}

/**
 * Arrête l'écoute temps réel
 */
export function stopRealtimeSync(): void {
  if (realtimeUnsubscribe) {
    realtimeUnsubscribe();
    realtimeUnsubscribe = null;
    console.log('[Sync] Realtime sync stopped');
  }
}

// ============================================
// BOUTON SYNCHRONISATION COMPLET
// ============================================

export interface FullSyncResult {
  success: boolean;
  photosUploaded: number;
  photosFailed: number;
  signalementsPushed: number;
  signalementsPulled: number;
  errors: string[];
  duration: number;
}

/**
 * Synchronisation complète déclenchée par le bouton "Synchroniser"
 * 1. Upload les photos non synchronisées vers Firebase Storage
 * 2. Pousse les signalements locaux vers Firestore
 * 3. Tire les signalements Firestore vers le local
 * 4. (optionnel) Sync via le backend API aussi
 */
export async function fullSync(useBackendToo: boolean = true): Promise<FullSyncResult> {
  const startTime = Date.now();
  const result: FullSyncResult = {
    success: true,
    photosUploaded: 0,
    photosFailed: 0,
    signalementsPushed: 0,
    signalementsPulled: 0,
    errors: [],
    duration: 0,
  };

  try {
    // Étape 1 : Upload photos vers Firebase Storage
    console.log('[Sync] Étape 1/3 : Upload des photos...');
    try {
      const photoResult = await syncAllPhotos();
      console.log('[Sync] ✅ Étape 1 terminée:', photoResult);
      result.photosUploaded = photoResult.uploaded.length;
      result.photosFailed = photoResult.failed.length;
      if (photoResult.failed.length > 0) {
        result.errors.push(`${photoResult.failed.length} photo(s) non uploadée(s)`);
      }
    } catch (photoErr: any) {
      console.error('[Sync] ❌ Étape 1 échouée:', photoErr);
      result.errors.push(`Photos: ${photoErr.message}`);
    }

    // Étape 2 : Push signalements locaux → Firestore
    console.log('[Sync] Étape 2/3 : Push signalements vers Firestore...');
    try {
      const pushResult = await pushLocalToFirestore();
      console.log('[Sync] ✅ Étape 2 terminée:', pushResult);
      result.signalementsPushed = pushResult.pushed.length;
      if (pushResult.failed.length > 0) {
        result.errors.push(...pushResult.failed.map((f) => `Push échec: ${f.id}`));
      }
    } catch (pushErr: any) {
      console.error('[Sync] ❌ Étape 2 échouée:', pushErr);
      result.errors.push(`Push Firestore: ${pushErr.message}`);
    }

    // Étape 3 : Pull signalements Firestore → Local
    console.log('[Sync] Étape 3/3 : Pull signalements depuis Firestore...');
    try {
      const pullResult = await pullFromFirestore();
      console.log('[Sync] ✅ Étape 3 terminée:', pullResult);
      result.signalementsPulled = pullResult.received.length;
    } catch (pullErr: any) {
      console.error('[Sync] ❌ Étape 3 échouée:', pullErr);
      result.errors.push(`Pull Firestore: ${pullErr.message}`);
    }

    // Optionnel : sync avec le backend API aussi (PostgreSQL)
    if (useBackendToo && navigator.onLine) {
      console.log('[Sync] Étape 4 (optionnelle) : Sync avec backend API...');
      try {
        await triggerSync('both');
        console.log('[Sync] ✅ Étape 4 terminée');
      } catch (e: any) {
        console.warn('[Sync] Backend sync skipped:', e.message);
        // Pas critique — la sync Firestore a fonctionné
      }
    }

    // Mettre à jour le timestamp de dernière sync
    setLastSyncTime();

    result.success = result.errors.length === 0;
  } catch (error: any) {
    result.success = false;
    result.errors.push(error.message);
    console.error('[Sync] Full sync failed:', error);
  }

  result.duration = Date.now() - startTime;
  console.log(`[Sync] Full sync completed in ${result.duration}ms`, result);
  return result;
}
