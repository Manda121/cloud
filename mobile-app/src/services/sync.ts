/**
 * Service de synchronisation Firestore ↔ Backend (Postgres)
 * 
 * Fonctionnement :
 * 1. Lit les signalements Firestore avec synced=false
 * 2. Les envoie au backend via POST /api/signalements/sync/from-firebase
 * 3. Marque les docs Firestore comme synced=true avec l'ID backend
 * 
 * Peut être déclenché manuellement (bouton) ou automatiquement
 */

import { db, auth as firebaseAuth } from './firebase';
import { getAuthToken, ensureAuthenticated } from './auth';
import { isBackendReachable, getBackendUrl } from './backend';
import {
  collection,
  getDocs,
  query,
  where,
  updateDoc,
  doc,
  addDoc,
  serverTimestamp,
  GeoPoint,
  Timestamp,
} from 'firebase/firestore';

const FIRESTORE_COLLECTION = 'signalements';

export interface SyncResult {
  total: number;
  synced: number;
  errors: number;
  details: Array<{
    firestore_id: string;
    id_signalement?: string;
    error?: string;
  }>;
}

/**
 * Récupère les signalements Firestore non synchronisés
 */
export async function getUnsyncedFirestoreSignalements(): Promise<any[]> {
  // Assurer qu'un utilisateur (même anonyme) est connecté
  try {
    await ensureAuthenticated();
  } catch {
    // Si impossible de s'authentifier, retourner vide
  }

  const user = firebaseAuth.currentUser;
  if (!user) return [];

  try {
    const q = query(
      collection(db, FIRESTORE_COLLECTION),
      where('uid', '==', user.uid),
      where('synced', '==', false),
    );
    const snapshot = await getDocs(q);

    return snapshot.docs.map((docSnap) => {
      const d = docSnap.data();
      return {
        firestore_id: docSnap.id,
        description: d.description ?? '',
        latitude: d.latitude ?? d.location?.latitude ?? 0,
        longitude: d.longitude ?? d.location?.longitude ?? 0,
        surface_m2: d.surface_m2 ?? null,
        budget: d.budget ?? null,
        date_signalement: d.date_signalement ?? '',
        photos: d.photos ?? [],
        source: 'FIREBASE',
        created_at: d.created_at instanceof Timestamp
          ? d.created_at.toDate().toISOString()
          : d.created_at ?? new Date().toISOString(),
      };
    });
  } catch (err: any) {
    console.error('[Sync] Erreur lecture Firestore non-synchronisés:', err.message);
    return [];
  }
}

/**
 * Synchronise les signalements Firestore → Backend (Postgres)
 * 
 * @returns SyncResult avec le détail de la synchronisation
 */
export async function syncFirestoreToBackend(): Promise<SyncResult> {
  const result: SyncResult = { total: 0, synced: 0, errors: 0, details: [] };

  // 1. Vérifier que le backend est joignable
  const reachable = await isBackendReachable();
  if (!reachable) {
    throw new Error('Backend non joignable. Vérifiez que Docker est lancé ou que vous avez une connexion au serveur.');
  }

  // 2. Récupérer les signalements non synchronisés
  const unsynced = await getUnsyncedFirestoreSignalements();
  result.total = unsynced.length;

  if (unsynced.length === 0) {
    return result;
  }

  // 3. Envoyer au backend
  let token = getAuthToken();
  if (!token) {
    try {
      token = await ensureAuthenticated();
    } catch {
      throw new Error('Vous devez être connecté pour synchroniser');
    }
  }

  try {
    const response = await fetch(`${getBackendUrl()}/api/signalements/sync/from-firebase`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ signalements: unsynced }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Erreur serveur' }));
      throw new Error(err.error || `Erreur ${response.status}`);
    }

    const data = await response.json();

    // 4. Marquer les docs Firestore comme synchronisés
    if (data.success && Array.isArray(data.success)) {
      for (const item of data.success) {
        try {
          const docRef = doc(db, FIRESTORE_COLLECTION, item.firestore_id);
          await updateDoc(docRef, {
            synced: true,
            id_signalement_server: item.id_signalement,
            synced_at: new Date().toISOString(),
          });
          result.synced++;
          result.details.push({
            firestore_id: item.firestore_id,
            id_signalement: item.id_signalement,
          });
        } catch (updateErr: any) {
          console.warn('[Sync] Erreur mise à jour Firestore doc:', item.firestore_id, updateErr.message);
          result.errors++;
          result.details.push({
            firestore_id: item.firestore_id,
            error: 'Synchronisé au backend mais erreur de mise à jour Firestore',
          });
        }
      }
    }

    // 5. Compter les erreurs côté backend
    if (data.errors && Array.isArray(data.errors)) {
      for (const item of data.errors) {
        result.errors++;
        result.details.push({
          firestore_id: item.firestore_id,
          error: item.error,
        });
      }
    }
  } catch (err: any) {
    console.error('[Sync] Erreur synchronisation batch:', err.message);
    throw err;
  }

  return result;
}

/**
 * Compte le nombre de signalements non synchronisés
 */
export async function getUnsyncedCount(): Promise<number> {
  const unsynced = await getUnsyncedFirestoreSignalements();
  return unsynced.length;
}

/**
 * Synchronise aussi les signalements localStorage → Firestore
 * (pour les signalements créés en mode totalement offline)
 */
export async function syncLocalToFirestore(): Promise<number> {
  // Assurer auth (anonyme si nécessaire)
  try {
    await ensureAuthenticated();
  } catch {
    // Si pas d'auth possible, on ne peut pas push vers Firestore
  }

  const user = firebaseAuth.currentUser;
  if (!user) return 0;

  try {
    const raw = localStorage.getItem('signalements');
    if (!raw) return 0;

    const locals: any[] = JSON.parse(raw);
    const unsyncedLocals = locals.filter((s) => !s.synced && s.source === 'LOCAL');

    if (unsyncedLocals.length === 0) return 0;

    let count = 0;

    for (const sig of unsyncedLocals) {
      try {
        await addDoc(collection(db, FIRESTORE_COLLECTION), {
          uid: user.uid,
          email: user.email,
          description: sig.description ?? '',
          latitude: sig.geom?.coordinates?.[1] ?? sig.latitude ?? 0,
          longitude: sig.geom?.coordinates?.[0] ?? sig.longitude ?? 0,
          location: new GeoPoint(
            sig.geom?.coordinates?.[1] ?? sig.latitude ?? 0,
            sig.geom?.coordinates?.[0] ?? sig.longitude ?? 0,
          ),
          surface_m2: sig.surface_m2 ?? null,
          budget: sig.budget ?? null,
          date_signalement: sig.date_signalement ?? '',
          photos: sig.photos ?? [],
          source: 'FIREBASE',
          synced: false,
          id_statut: sig.id_statut ?? 1,
          created_at: serverTimestamp(),
        });

        // Marquer le signalement local comme synced vers Firestore
        const idx = locals.findIndex((s) => s.id_signalement === sig.id_signalement);
        if (idx >= 0) {
          locals[idx].synced = true;
          locals[idx].source = 'FIREBASE';
        }
        count++;
      } catch (err: any) {
        console.warn('[Sync] Erreur push local → Firestore:', err.message);
      }
    }

    localStorage.setItem('signalements', JSON.stringify(locals));
    console.log(`[Sync] ${count} signalements locaux poussés vers Firestore`);
    return count;
  } catch (err: any) {
    console.error('[Sync] Erreur syncLocalToFirestore:', err.message);
    return 0;
  }
}

/**
 * Synchronisation complète :
 * 1. localStorage → Firestore (si des signalements locaux existent)
 * 2. Firestore → Backend (si le backend est joignable)
 * 3. Mises à jour de statut en attente → Backend
 */
export async function fullSync(): Promise<{
  localToFirestore: number;
  firestoreToBackend: SyncResult | null;
  statusUpdates: number;
}> {
  // Étape 1 : Local → Firestore
  const localCount = await syncLocalToFirestore();

  // Étape 2 : Firestore → Backend
  let backendResult: SyncResult | null = null;
  try {
    backendResult = await syncFirestoreToBackend();
  } catch (err: any) {
    console.warn('[Sync] Backend sync skipped:', err.message);
  }

  // Étape 3 : Sync des mises à jour de statut en attente
  let statusUpdatesCount = 0;
  try {
    statusUpdatesCount = await syncPendingStatusUpdates();
  } catch (err: any) {
    console.warn('[Sync] Status updates sync skipped:', err.message);
  }

  return {
    localToFirestore: localCount,
    firestoreToBackend: backendResult,
    statusUpdates: statusUpdatesCount,
  };
}

// =====================================================
// GESTION DES MISES À JOUR DE STATUT EN ATTENTE
// =====================================================

const PENDING_STATUS_UPDATES_KEY = 'pending_status_updates';

export interface PendingStatusUpdate {
  id: string;
  signalement_id: string;         // ID du signalement (serveur ou Firestore)
  firestore_id?: string;          // ID Firestore si applicable
  new_status: number;
  created_at: string;
  source: 'LOCAL' | 'FIREBASE' | 'BACKEND';
}

/**
 * Ajoute une mise à jour de statut en attente (quand le backend est indisponible)
 */
export function addPendingStatusUpdate(update: Omit<PendingStatusUpdate, 'id' | 'created_at'>): void {
  const pending = getPendingStatusUpdates();
  
  // Éviter les doublons : si une mise à jour existe déjà pour ce signalement, la remplacer
  const existingIdx = pending.findIndex(p => p.signalement_id === update.signalement_id);
  
  const newUpdate: PendingStatusUpdate = {
    id: `status_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    ...update,
    created_at: new Date().toISOString(),
  };

  if (existingIdx >= 0) {
    pending[existingIdx] = newUpdate;
  } else {
    pending.push(newUpdate);
  }

  localStorage.setItem(PENDING_STATUS_UPDATES_KEY, JSON.stringify(pending));
  console.log('[Sync] Mise à jour de statut ajoutée en attente:', newUpdate);
}

/**
 * Récupère toutes les mises à jour de statut en attente
 */
export function getPendingStatusUpdates(): PendingStatusUpdate[] {
  try {
    const raw = localStorage.getItem(PENDING_STATUS_UPDATES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Supprime une mise à jour de statut de la file d'attente
 */
export function removePendingStatusUpdate(id: string): void {
  const pending = getPendingStatusUpdates();
  const filtered = pending.filter(p => p.id !== id);
  localStorage.setItem(PENDING_STATUS_UPDATES_KEY, JSON.stringify(filtered));
}

/**
 * Compte le nombre de mises à jour en attente
 */
export function getPendingStatusUpdatesCount(): number {
  return getPendingStatusUpdates().length;
}

/**
 * Synchronise les mises à jour de statut en attente vers le backend
 * Retourne le nombre de mises à jour synchronisées avec succès
 */
export async function syncPendingStatusUpdates(): Promise<number> {
  const reachable = await isBackendReachable();
  if (!reachable) {
    console.log('[Sync] Backend non joignable, skip sync status updates');
    return 0;
  }

  const pending = getPendingStatusUpdates();
  if (pending.length === 0) {
    return 0;
  }

  let token = getAuthToken();
  if (!token) {
    try {
      token = await ensureAuthenticated();
    } catch {
      console.warn('[Sync] Pas de token pour sync status updates');
      return 0;
    }
  }

  let successCount = 0;
  const backendUrl = getBackendUrl();

  for (const update of pending) {
    try {
      // Chercher l'ID serveur si on n'a que l'ID Firestore
      let serverId = update.signalement_id;
      
      // Si source FIREBASE, essayer de trouver l'ID serveur depuis Firestore
      if (update.source === 'FIREBASE' && update.firestore_id) {
        // L'ID serveur pourrait être stocké localement
        const localSigs = JSON.parse(localStorage.getItem('signalements') || '[]');
        const local = localSigs.find((s: any) => 
          s.id_signalement === update.firestore_id || 
          s.id_signalement_server === update.firestore_id
        );
        if (local?.id_signalement_server) {
          serverId = local.id_signalement_server;
        }
      }

      const response = await fetch(`${backendUrl}/api/signalements/${serverId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ id_statut: update.new_status }),
      });

      if (response.ok) {
        removePendingStatusUpdate(update.id);
        successCount++;
        console.log('[Sync] Status update synced:', update.signalement_id, '→', update.new_status);
        
        // Mettre à jour Firestore aussi si applicable
        if (update.firestore_id) {
          try {
            const docRef = doc(db, FIRESTORE_COLLECTION, update.firestore_id);
            await updateDoc(docRef, { synced: true });
          } catch {
            // Ignore
          }
        }
      } else {
        // Si 404, le signalement n'existe plus côté serveur — supprimer de la queue
        if (response.status === 404) {
          removePendingStatusUpdate(update.id);
          console.warn('[Sync] Signalement introuvable côté serveur, supprimé de la queue:', update.signalement_id);
        }
      }
    } catch (err: any) {
      console.warn('[Sync] Erreur sync status update:', update.signalement_id, err.message);
    }
  }

  if (successCount > 0) {
    window.dispatchEvent(new CustomEvent('sync:status-updates-completed', { detail: { count: successCount } }));
  }

  return successCount;
}

