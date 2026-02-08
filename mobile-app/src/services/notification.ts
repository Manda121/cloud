/**
 * Service de gestion des notifications - MODE HYBRIDE
 * Appelle l'API identity-provider si disponible, sinon fallback silencieux
 */

import { getAuthToken } from './auth';
import { isBackendReachable, getBackendUrl } from './backend';

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
  // Vérifier si le backend est joignable d'abord
  const reachable = await isBackendReachable();
  if (!reachable) {
    console.log('[NotificationService] Backend non joignable, notifications indisponibles');
    return [];
  }

  const params = new URLSearchParams();
  if (options?.unread) params.append('unread', 'true');
  if (options?.limit) params.append('limit', String(options.limit));

  const url = `${getBackendUrl()}/api/notifications${params.toString() ? '?' + params : ''}`;
  console.log('[NotificationService] GET', url);
  const headers = getAuthHeaders();
  const response = await fetch(url, { method: 'GET', headers });
  if (!response.ok) {
    const errorBody = await response.text();
    console.error('[NotificationService] Error body:', errorBody);
    throw new Error(`Erreur ${response.status}: ${errorBody}`);
  }
  return response.json();
}

/**
 * Compter les notifications non lues
 */
export async function getUnreadCount(): Promise<number> {
  // Vérifier si le backend est joignable
  const reachable = await isBackendReachable();
  if (!reachable) {
    return 0;
  }

  const url = `${getBackendUrl()}/api/notifications/unread-count`;
  const response = await fetch(url, {
    method: 'GET',
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    return 0;
  }
  const data = await response.json();
  return data.count;
}

/**
 * Marquer une notification comme lue
 */
export async function markNotificationAsRead(id: number): Promise<void> {
  const response = await fetch(`${getBackendUrl()}/api/notifications/${id}/read`, {
    method: 'PUT',
    headers: getAuthHeaders(),
  });
  if (!response.ok) throw new Error(`Erreur ${response.status}`);
}

/**
 * Marquer toutes les notifications comme lues
 */
export async function markAllNotificationsAsRead(): Promise<void> {
  const response = await fetch(`${getBackendUrl()}/api/notifications/mark-all-read`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!response.ok) throw new Error(`Erreur ${response.status}`);
}
