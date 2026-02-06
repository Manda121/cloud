/**
 * Service de synchronisation pour l'application mobile
 * Gère la synchronisation bidirectionnelle avec le backend
 */

import { getAuthToken } from './auth';

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
