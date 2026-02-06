/**
 * Service de notifications pour l'application mobile
 * Gère les notifications in-app et push (FCM)
 */

import { getAuthToken } from './auth';
import { initFirebase } from '../config/firebase';
// @ts-ignore - Firebase types
import { getMessaging, getToken, onMessage, Messaging } from 'firebase/messaging';

const API_BASE = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:3000';
const VAPID_KEY = (import.meta as any).env?.VITE_FIREBASE_VAPID_KEY ?? '';

// ============================================
// TYPES
// ============================================

export interface Notification {
  id: number;
  id_user: number;
  id_signalement: string;
  type: string;
  title: string;
  message: string;
  data: Record<string, unknown> | null;
  read: boolean;
  read_at: string | null;
  created_at: string;
  signalement_description?: string;
  current_status?: string;
}

export interface NotificationsResponse {
  success: boolean;
  unreadCount: number;
  count: number;
  data: Notification[];
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
// API CALLS - NOTIFICATIONS
// ============================================

/**
 * Récupérer les notifications de l'utilisateur
 */
export async function getNotifications(options: {
  limit?: number;
  offset?: number;
  unreadOnly?: boolean;
} = {}): Promise<NotificationsResponse> {
  const params = new URLSearchParams();
  if (options.limit) params.append('limit', String(options.limit));
  if (options.offset) params.append('offset', String(options.offset));
  if (options.unreadOnly) params.append('unreadOnly', 'true');

  const url = `${API_BASE}/api/notifications${params.toString() ? '?' + params : ''}`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Erreur ${response.status}`);
  }

  return response.json();
}

/**
 * Récupérer le nombre de notifications non lues
 */
export async function getUnreadCount(): Promise<number> {
  const response = await fetch(`${API_BASE}/api/notifications/unread-count`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Erreur ${response.status}`);
  }

  const result = await response.json();
  return result.unreadCount;
}

/**
 * Marquer une notification comme lue
 */
export async function markNotificationAsRead(id: number): Promise<Notification> {
  const response = await fetch(`${API_BASE}/api/notifications/${id}/read`, {
    method: 'PUT',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Erreur ${response.status}`);
  }

  const result = await response.json();
  return result.data;
}

/**
 * Marquer toutes les notifications comme lues
 */
export async function markAllNotificationsAsRead(): Promise<void> {
  const response = await fetch(`${API_BASE}/api/notifications/read-all`, {
    method: 'PUT',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Erreur ${response.status}`);
  }
}

// ============================================
// FCM - PUSH NOTIFICATIONS
// ============================================

let messaging: Messaging | null = null;

/**
 * Initialiser Firebase Cloud Messaging
 */
export function initFCM(): Messaging | null {
  try {
    const { app } = initFirebase();
    messaging = getMessaging(app);
    return messaging;
  } catch (error) {
    console.error('[Notifications] Error initializing FCM:', error);
    return null;
  }
}

/**
 * Demander la permission et récupérer le token FCM
 */
export async function requestNotificationPermission(): Promise<string | null> {
  try {
    const permission = await Notification.requestPermission();
    
    if (permission !== 'granted') {
      console.log('[Notifications] Permission denied');
      return null;
    }

    if (!messaging) {
      initFCM();
    }

    if (!messaging) {
      console.error('[Notifications] FCM not initialized');
      return null;
    }

    const token = await getToken(messaging, { vapidKey: VAPID_KEY });
    console.log('[Notifications] FCM Token:', token);
    
    return token;
  } catch (error) {
    console.error('[Notifications] Error getting FCM token:', error);
    return null;
  }
}

/**
 * Enregistrer le token FCM auprès du backend
 */
export async function registerFcmToken(fcmToken: string, deviceType: string = 'mobile'): Promise<void> {
  const response = await fetch(`${API_BASE}/api/notifications/register-token`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ fcmToken, deviceType }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erreur inconnue' }));
    throw new Error(error.error || `Erreur ${response.status}`);
  }
}

/**
 * Supprimer le token FCM (déconnexion)
 */
export async function removeFcmToken(fcmToken: string): Promise<void> {
  const response = await fetch(`${API_BASE}/api/notifications/token`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
    body: JSON.stringify({ fcmToken }),
  });

  if (!response.ok) {
    throw new Error(`Erreur ${response.status}`);
  }
}

/**
 * Initialiser les notifications push et enregistrer le token
 */
export async function setupPushNotifications(): Promise<boolean> {
  try {
    // 1. Demander la permission
    const token = await requestNotificationPermission();
    
    if (!token) {
      return false;
    }

    // 2. Enregistrer le token auprès du backend
    await registerFcmToken(token);

    // 3. Écouter les messages entrants
    setupMessageListener();

    console.log('[Notifications] Push notifications setup complete');
    return true;
  } catch (error) {
    console.error('[Notifications] Error setting up push notifications:', error);
    return false;
  }
}

// ============================================
// MESSAGE LISTENERS
// ============================================

type NotificationCallback = (notification: {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}) => void;

const notificationListeners: NotificationCallback[] = [];

/**
 * Ajouter un listener pour les notifications entrantes
 */
export function addNotificationListener(callback: NotificationCallback): () => void {
  notificationListeners.push(callback);
  
  // Retourner une fonction pour se désabonner
  return () => {
    const index = notificationListeners.indexOf(callback);
    if (index > -1) {
      notificationListeners.splice(index, 1);
    }
  };
}

/**
 * Configurer le listener de messages FCM
 */
function setupMessageListener(): void {
  if (!messaging) {
    initFCM();
  }

  if (!messaging) {
    return;
  }

  onMessage(messaging, (payload) => {
    console.log('[Notifications] Message received:', payload);

    const notification = {
      title: payload.notification?.title || 'Notification',
      body: payload.notification?.body || '',
      data: payload.data,
    };

    // Notifier tous les listeners
    notificationListeners.forEach(callback => {
      try {
        callback(notification);
      } catch (error) {
        console.error('[Notifications] Error in listener:', error);
      }
    });

    // Afficher une notification système si l'app est en arrière-plan
    if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(notification.title, {
        body: notification.body,
        icon: '/favicon.ico',
      });
    }
  });
}

// ============================================
// LOCAL NOTIFICATIONS STORAGE
// ============================================

const LOCAL_NOTIFICATIONS_KEY = 'local_notifications';

/**
 * Stocker une notification localement (pour mode offline)
 */
export function storeLocalNotification(notification: Partial<Notification>): void {
  const stored = getLocalNotifications();
  stored.unshift({
    ...notification,
    id: Date.now(),
    created_at: new Date().toISOString(),
    read: false,
  } as Notification);
  
  // Garder seulement les 100 dernières
  const limited = stored.slice(0, 100);
  localStorage.setItem(LOCAL_NOTIFICATIONS_KEY, JSON.stringify(limited));
}

/**
 * Récupérer les notifications stockées localement
 */
export function getLocalNotifications(): Notification[] {
  try {
    const raw = localStorage.getItem(LOCAL_NOTIFICATIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Vider les notifications locales
 */
export function clearLocalNotifications(): void {
  localStorage.removeItem(LOCAL_NOTIFICATIONS_KEY);
}

// ============================================
// POLLING (FALLBACK POUR FCM)
// ============================================

let pollingInterval: ReturnType<typeof setInterval> | null = null;
let lastKnownUnreadCount = 0;

/**
 * Démarrer le polling des notifications (fallback si FCM ne fonctionne pas)
 */
export function startNotificationPolling(
  intervalMs: number = 30000,
  onNewNotification?: NotificationCallback
): void {
  if (pollingInterval) {
    clearInterval(pollingInterval);
  }

  pollingInterval = setInterval(async () => {
    try {
      const count = await getUnreadCount();
      
      if (count > lastKnownUnreadCount && onNewNotification) {
        // Il y a de nouvelles notifications
        const { data } = await getNotifications({ unreadOnly: true, limit: 5 });
        
        data.forEach(notif => {
          onNewNotification({
            title: notif.title,
            body: notif.message,
            data: notif.data || undefined,
          });
        });
      }
      
      lastKnownUnreadCount = count;
    } catch (error) {
      console.error('[Notifications] Polling error:', error);
    }
  }, intervalMs);

  console.log(`[Notifications] Polling started (interval: ${intervalMs}ms)`);
}

/**
 * Arrêter le polling des notifications
 */
export function stopNotificationPolling(): void {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
    console.log('[Notifications] Polling stopped');
  }
}
