/**
 * Service de gestion des notifications
 * Appelle l'API identity-provider avec authentification
 */

import { getAuthToken } from './auth';

const API_BASE = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:3000';

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
  const params = new URLSearchParams();
  if (options?.unread) params.append('unread', 'true');
  if (options?.limit) params.append('limit', String(options.limit));

  const url = `${API_BASE}/api/notifications${params.toString() ? '?' + params : ''}`;
  console.log('[NotificationService] GET', url);
  const headers = getAuthHeaders();
  console.log('[NotificationService] Headers:', JSON.stringify(headers));
  const response = await fetch(url, { method: 'GET', headers });
  console.log('[NotificationService] Response status:', response.status);
  if (!response.ok) {
    const errorBody = await response.text();
    console.error('[NotificationService] Error body:', errorBody);
    throw new Error(`Erreur ${response.status}: ${errorBody}`);
  }
  const data = await response.json();
  console.log('[NotificationService] Data:', data);
  return data;
}

/**
 * Compter les notifications non lues
 */
export async function getUnreadCount(): Promise<number> {
  const url = `${API_BASE}/api/notifications/unread-count`;
  console.log('[NotificationService] getUnreadCount GET', url);
  const response = await fetch(url, {
    method: 'GET',
    headers: getAuthHeaders(),
  });
  console.log('[NotificationService] getUnreadCount status:', response.status);
  if (!response.ok) {
    const errorBody = await response.text();
    console.error('[NotificationService] getUnreadCount error:', errorBody);
    throw new Error(`Erreur ${response.status}: ${errorBody}`);
  }
  const data = await response.json();
  console.log('[NotificationService] getUnreadCount data:', data);
  return data.count;
}

/**
 * Marquer une notification comme lue
 */
export async function markNotificationAsRead(id: number): Promise<void> {
  const response = await fetch(`${API_BASE}/api/notifications/${id}/read`, {
    method: 'PUT',
    headers: getAuthHeaders(),
  });
  if (!response.ok) throw new Error(`Erreur ${response.status}`);
}

/**
 * Marquer toutes les notifications comme lues
 */
export async function markAllNotificationsAsRead(): Promise<void> {
  const response = await fetch(`${API_BASE}/api/notifications/mark-all-read`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!response.ok) throw new Error(`Erreur ${response.status}`);
}
