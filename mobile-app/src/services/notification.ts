/**
 * Service de gestion des notifications - MODE HYBRIDE
 * Appelle l'API identity-provider si disponible, sinon fallback silencieux
 */

import { getAuthToken } from './auth';
import { isBackendReachable, getBackendUrl } from './backend';
import { db, auth as firebaseAuth } from './firebase';
import { collection, addDoc, query, where, getDocs, serverTimestamp, Timestamp, doc, updateDoc } from 'firebase/firestore';

export interface Notification {
  id: number;
  id_user: number;
  id_signalement: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
  signalement_description?: string;
  latitude?: number;
  longitude?: number;
}

// Local fallback key for notifications created while fully offline
const LOCAL_NOTIFICATIONS_KEY = 'notifications_local';

/**
 * Create a notification: backend if available, otherwise Firestore/local
 */
export async function createNotification(payload: {
  id_signalement?: string;
  title: string;
  message: string;
  latitude?: number;
  longitude?: number;
}): Promise<{ origin: 'backend' | 'firestore' | 'local' }> {
  console.log('[NotificationService] createNotification called:', payload.title);
  
  const reachable = await isBackendReachable();
  if (reachable) {
    // Try backend first
    try {
      const response = await fetch(`${getBackendUrl()}/api/notifications`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });
      if (response.ok) {
        console.log('[NotificationService] Created on backend');
        return { origin: 'backend' };
      }
    } catch (err) {
      console.warn('[NotificationService] Backend create failed, falling back', err);
    }
  }

  // Firestore fallback
  try {
    await (await import('./auth')).ensureAuthenticated();
    const fbUser = firebaseAuth.currentUser;
    if (fbUser) {
      console.log('[NotificationService] Writing to Firestore with uid:', fbUser.uid);
      await addDoc(collection(db, 'notifications'), {
        uid: fbUser.uid,
        id_signalement: payload.id_signalement ?? null,
        title: payload.title,
        message: payload.message,
        latitude: payload.latitude ?? null,
        longitude: payload.longitude ?? null,
        read: false,
        created_at: serverTimestamp(),
        source: 'FIREBASE',
        synced: false, // Marqueur pour sync ultérieure vers backend
      });
      console.log('[NotificationService] Created on Firestore');
      return { origin: 'firestore' };
    } else {
      console.warn('[NotificationService] No Firebase user available for Firestore write');
    }
  } catch (err) {
    console.warn('[NotificationService] Firestore create failed:', (err as any)?.message ?? err);
  }

  // Local fallback
  try {
    const raw = localStorage.getItem(LOCAL_NOTIFICATIONS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    arr.unshift({
      id: `local_${Date.now()}`,
      id_user: 0,
      id_signalement: payload.id_signalement ?? '',
      type: 'info',
      title: payload.title,
      message: payload.message,
      read: false,
      created_at: new Date().toISOString(),
      latitude: payload.latitude,
      longitude: payload.longitude,
    });
    localStorage.setItem(LOCAL_NOTIFICATIONS_KEY, JSON.stringify(arr));
    console.log('[NotificationService] Created locally');
    return { origin: 'local' };
  } catch (err) {
    console.warn('[NotificationService] Saving local notification failed:', err);
  }

  // Fallback ultime: retourner local même si tout a échoué
  return { origin: 'local' };
}


function getAuthHeaders(): HeadersInit {
  const token = getAuthToken();
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

/**
 * Récupérer les notifications
 */
export async function getNotifications(options?: { unread?: boolean; limit?: number }): Promise<Notification[]> {
  // 1) Si le backend est joignable, utiliser l'API
  const reachable = await isBackendReachable();
  if (reachable) {
    const params = new URLSearchParams();
    if (options?.unread) params.append('unread', 'true');
    if (options?.limit) params.append('limit', String(options.limit));

    const url = `${getBackendUrl()}/api/notifications${params.toString() ? '?' + params : ''}`;
    console.log('[NotificationService] GET (backend)', url);
    const headers = getAuthHeaders();
    const response = await fetch(url, { method: 'GET', headers });
    if (!response.ok) {
      const errorBody = await response.text();
      console.error('[NotificationService] Error body:', errorBody);
      throw new Error(`Erreur ${response.status}: ${errorBody}`);
    }
    return response.json();
  }

  // 2) Backend indisponible → tenter Firestore (si auth possible)
  try {
    await (await import('./auth')).ensureAuthenticated();
    const fbUser = firebaseAuth.currentUser;
    if (!fbUser) throw new Error('Pas d\'utilisateur Firebase');

    // Requête simple sans orderBy (évite le besoin d'un index composite)
    let q = query(collection(db, 'notifications'), where('uid', '==', fbUser.uid));
    if (options?.unread) {
      q = query(collection(db, 'notifications'), where('uid', '==', fbUser.uid), where('read', '==', false));
    }
    
    const snapshot = await getDocs(q);
    const notifications = snapshot.docs.map((d) => {
      const data: any = d.data();
      return {
        id: (d.id as any),
        id_user: 0,
        id_signalement: data.id_signalement ?? '',
        type: data.type ?? 'info',
        title: data.title ?? '',
        message: data.message ?? '',
        read: data.read ?? false,
        created_at: data.created_at instanceof Timestamp ? data.created_at.toDate().toISOString() : (data.created_at ?? new Date().toISOString()),
        signalement_description: data.signalement_description,
        latitude: data.latitude,
        longitude: data.longitude,
      } as Notification;
    });
    
    // Tri côté client (plus récent en premier)
    notifications.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    console.log('[NotificationService] Firestore fallback returned', notifications.length, 'notifications');
    return notifications;
  } catch (err) {
    console.warn('[NotificationService] Firestore fallback failed:', (err as any)?.message ?? err);
  }

  // 3) Dernier fallback : notifications locales stockées en localStorage
  try {
    const raw = localStorage.getItem(LOCAL_NOTIFICATIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Compter les notifications non lues
 */
export async function getUnreadCount(): Promise<number> {
  // Backend first
  const reachable = await isBackendReachable();
  if (reachable) {
    const url = `${getBackendUrl()}/api/notifications/unread-count`;
    const response = await fetch(url, {
      method: 'GET',
      headers: getAuthHeaders(),
    });
    if (!response.ok) return 0;
    const data = await response.json();
    return data.count;
  }

  // Firestore fallback
  try {
    await (await import('./auth')).ensureAuthenticated();
    const fbUser = firebaseAuth.currentUser;
    if (!fbUser) return 0;
    const q = query(collection(db, 'notifications'), where('uid', '==', fbUser.uid), where('read', '==', false));
    const snapshot = await getDocs(q);
    return snapshot.size;
  } catch (err) {
    // Local fallback
    try {
      const raw = localStorage.getItem(LOCAL_NOTIFICATIONS_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return arr.filter((n: any) => !n.read).length;
    } catch {
      return 0;
    }
  }
}

/**
 * Marquer une notification comme lue
 */
export async function markNotificationAsRead(id: number): Promise<void> {
  const reachable = await isBackendReachable();
  if (reachable) {
    const response = await fetch(`${getBackendUrl()}/api/notifications/${id}/read`, {
      method: 'PUT',
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error(`Erreur ${response.status}`);
    return;
  }

  // Firestore fallback: essayer marquer dans Firestore
  try {
    await (await import('./auth')).ensureAuthenticated();
    const fbUser = firebaseAuth.currentUser;
    if (!fbUser) throw new Error('Pas d\'utilisateur Firebase');
    // id may be firestore doc id
    const docRef = doc(db, 'notifications', String(id));
    await updateDoc(docRef, { read: true });
    return;
  } catch (err) {
    // Dernier fallback: localStorage
    try {
      const raw = localStorage.getItem(LOCAL_NOTIFICATIONS_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      const idx = arr.findIndex((n: any) => String(n.id) === String(id));
      if (idx >= 0) {
        arr[idx].read = true;
        localStorage.setItem(LOCAL_NOTIFICATIONS_KEY, JSON.stringify(arr));
      }
    } catch { }
  }
}

/**
 * Marquer toutes les notifications comme lues
 */
export async function markAllNotificationsAsRead(): Promise<void> {
  const reachable = await isBackendReachable();
  if (reachable) {
    const response = await fetch(`${getBackendUrl()}/api/notifications/mark-all-read`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error(`Erreur ${response.status}`);
    return;
  }

  // Firestore fallback: marquer toutes comme lues
  try {
    await (await import('./auth')).ensureAuthenticated();
    const fbUser = firebaseAuth.currentUser;
    if (!fbUser) return;
    const q = query(collection(db, 'notifications'), where('uid', '==', fbUser.uid), where('read', '==', false));
    const snapshot = await getDocs(q);
    for (const d of snapshot.docs) {
      const docRef = doc(db, 'notifications', d.id);
      await updateDoc(docRef, { read: true });
    }
    return;
  } catch {
    // Local fallback
    try {
      const raw = localStorage.getItem(LOCAL_NOTIFICATIONS_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      for (const n of arr) n.read = true;
      localStorage.setItem(LOCAL_NOTIFICATIONS_KEY, JSON.stringify(arr));
    } catch { }
  }
}
