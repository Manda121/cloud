/**
 * Service de gestion des signalements
 * Appelle l'API identity-provider avec authentification Firebase/Local
 */

import { getAuthToken } from './auth';

const API_BASE = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:3000';

export interface SignalementCreate {
  description: string;
  latitude: number;
  longitude: number;
  surface_m2?: number;
  budget?: number;
  date_signalement?: string;
  source?: 'LOCAL' | 'FIREBASE';
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

/**
 * Crée un nouveau signalement via l'API
 */
export async function createSignalement(data: SignalementCreate): Promise<Signalement> {
  const response = await fetch(`${API_BASE}/api/signalements`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erreur inconnue' }));
    throw new Error(error.error || `Erreur ${response.status}`);
  }

  return response.json();
}

/**
 * Récupère tous les signalements
 */
export async function getSignalements(): Promise<Signalement[]> {
  const response = await fetch(`${API_BASE}/api/signalements`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Erreur ${response.status}`);
  }

  return response.json();
}

/**
 * Récupère un signalement par son ID
 */
export async function getSignalementById(id: string): Promise<Signalement> {
  const response = await fetch(`${API_BASE}/api/signalements/${encodeURIComponent(id)}`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Erreur ${response.status}`);
  }

  return response.json();
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
 */
export async function getSignalementsGeoJSON(filters?: { userId?: number; statutId?: number }): Promise<FeatureCollection> {
  const params = new URLSearchParams();
  if (filters?.userId) params.append('userId', String(filters.userId));
  if (filters?.statutId) params.append('statutId', String(filters.statutId));

  const url = `${API_BASE}/api/signalements/geo/geojson${params.toString() ? '?' + params : ''}`;
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

  const response = await fetch(`${API_BASE}/api/signalements/geo/bbox?${params}`, {
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

  const response = await fetch(`${API_BASE}/api/signalements/geo/nearby?${params}`, {
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
  const response = await fetch(`${API_BASE}/api/signalements/stats`, {
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

export function saveLocalSignalement(signalement: any): void {
  const list = getLocalSignalements();
  list.push(signalement);
  localStorage.setItem('signalements', JSON.stringify(list));
}

export function updateLocalSignalement(id: string, updates: Partial<any>): void {
  const list = getLocalSignalements();
  const idx = list.findIndex((s: any) => s.id_signalement === id);
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...updates };
    localStorage.setItem('signalements', JSON.stringify(list));
  }
}
