/**
 * Service de gestion des photos pour les signalements
 * Upload vers Firebase Storage + stockage local offline
 */

import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { getFirebaseStorage } from '../config/firebase';
import { getCurrentUser } from './auth';

const LOCAL_PHOTOS_KEY = 'local_photos';

export interface PhotoData {
  /** ID unique de la photo */
  id: string;
  /** ID du signalement associé */
  signalementId: string;
  /** URL Firebase Storage de l'image compressée (null si pas encore uploadée) */
  firebaseUrl: string | null;
  /** URL Firebase Storage de la miniature (null si pas encore uploadée) */
  thumbnailUrl: string | null;
  /** Data URI en base64 pour affichage local / offline (image compressée) */
  localDataUri: string;
  /** Data URI en base64 de la miniature (pour affichage rapide dans les listes) */
  thumbnailDataUri: string;
  /** Nom du fichier */
  fileName: string;
  /** Taille en octets (image compressée) */
  fileSize: number;
  /** Taille de la miniature en octets */
  thumbnailSize: number;
  /** Déjà uploadée vers Firebase ? */
  uploaded: boolean;
  /** Date de création */
  createdAt: string;
}

// ============================================
// CAPTURE PHOTO (depuis input file ou caméra)
// ============================================

/**
 * Convertit un File en data URI base64
 */
export function fileToDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Convertit un data URI en Blob (pour upload)
 */
export function dataUriToBlob(dataUri: string): Blob {
  const [header, base64] = dataUri.split(',');
  const mimeMatch = header.match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const binary = atob(base64);
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    array[i] = binary.charCodeAt(i);
  }
  return new Blob([array], { type: mime });
}

/**
 * Compresse une image (réduit la taille pour upload mobile)
 * @param dataUri - Image source en data URI
 * @param maxWidth - Largeur max (défaut 1024px)
 * @param quality - Qualité JPEG/WebP 0-1 (défaut 0.7)
 * @param format - Format de sortie ('webp' ou 'jpeg')
 */
export function compressImage(
  dataUri: string,
  maxWidth: number = 1024,
  quality: number = 0.7,
  format: 'webp' | 'jpeg' = 'webp'
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let { width, height } = img;

      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context non disponible'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      
      // Essayer WebP, fallback vers JPEG si non supporté
      const mimeType = format === 'webp' ? 'image/webp' : 'image/jpeg';
      const result = canvas.toDataURL(mimeType, quality);
      
      // Si WebP non supporté, le navigateur retourne PNG → fallback JPEG
      if (format === 'webp' && result.startsWith('data:image/png')) {
        resolve(canvas.toDataURL('image/jpeg', quality));
      } else {
        resolve(result);
      }
    };
    img.onerror = reject;
    img.src = dataUri;
  });
}

/**
 * Génère une miniature (thumbnail) pour affichage rapide dans les listes
 * @param dataUri - Image source en data URI
 * @param maxWidth - Largeur max de la miniature (défaut 200px)
 * @param quality - Qualité (défaut 0.6)
 */
export function generateThumbnail(
  dataUri: string,
  maxWidth: number = 200,
  quality: number = 0.6
): Promise<string> {
  return compressImage(dataUri, maxWidth, quality, 'webp');
}

/**
 * Calcule la taille approximative d'un data URI en octets
 */
export function getDataUriSize(dataUri: string): number {
  const base64 = dataUri.split(',')[1] || '';
  return Math.round((base64.length * 3) / 4);
}

// ============================================
// UPLOAD VERS FIREBASE STORAGE
// ============================================

/**
 * Upload une photo vers Firebase Storage
 * @param signalementId - ID du signalement
 * @param dataUri - Image en data URI base64
 * @param fileName - Nom du fichier
 * @param isThumb - Est-ce une miniature ?
 * @returns URL de téléchargement Firebase
 */
export async function uploadPhotoToFirebase(
  signalementId: string,
  dataUri: string,
  fileName?: string,
  isThumb: boolean = false
): Promise<string> {
  const storage = getFirebaseStorage();
  const user = getCurrentUser();
  const uid = user?.uid || user?.firebase_uid || 'anonymous';
  const timestamp = Date.now();
  const name = fileName || `photo_${timestamp}`;
  
  // Déterminer l'extension selon le format
  const mimeType = dataUri.startsWith('data:image/webp') ? 'image/webp' : 'image/jpeg';
  const ext = mimeType === 'image/webp' ? 'webp' : 'jpg';
  const prefix = isThumb ? 'thumb_' : '';

  // Chemin : signalements/{signalementId}/photos/{prefix}{uid}_{timestamp}_{name}.{ext}
  const storagePath = `signalements/${signalementId}/photos/${prefix}${uid}_${timestamp}_${name}.${ext}`;
  const storageRef = ref(storage, storagePath);

  // Convertir data URI → Blob
  const blob = dataUriToBlob(dataUri);

  // Upload
  const snapshot = await uploadBytes(storageRef, blob, {
    contentType: mimeType,
    customMetadata: {
      signalementId,
      uploadedBy: uid,
      uploadedAt: new Date().toISOString(),
      type: isThumb ? 'thumbnail' : 'full',
    },
  });

  // Récupérer l'URL publique
  const downloadUrl = await getDownloadURL(snapshot.ref);
  console.log(`[Photo] Uploaded ${isThumb ? 'thumbnail' : 'full'} to Firebase: ${storagePath}`);

  return downloadUrl;
}

/**
 * Upload une photo complète (image + miniature) vers Firebase Storage
 * @returns { fullUrl, thumbnailUrl }
 */
export async function uploadPhotoWithThumbnail(
  signalementId: string,
  fullDataUri: string,
  thumbDataUri: string,
  fileName?: string
): Promise<{ fullUrl: string; thumbnailUrl: string }> {
  // Upload les deux en parallèle
  const [fullUrl, thumbnailUrl] = await Promise.all([
    uploadPhotoToFirebase(signalementId, fullDataUri, fileName, false),
    uploadPhotoToFirebase(signalementId, thumbDataUri, fileName, true),
  ]);
  
  return { fullUrl, thumbnailUrl };
}

/**
 * Supprime une photo de Firebase Storage
 */
export async function deletePhotoFromFirebase(firebaseUrl: string): Promise<void> {
  try {
    const storage = getFirebaseStorage();
    const storageRef = ref(storage, firebaseUrl);
    await deleteObject(storageRef);
    console.log('[Photo] Deleted from Firebase:', firebaseUrl);
  } catch (error) {
    console.warn('[Photo] Delete failed (may not exist):', error);
  }
}

// ============================================
// STOCKAGE LOCAL (OFFLINE)
// ============================================

/**
 * Sauvegarde une photo localement (localStorage / IndexedDB)
 */
export function savePhotoLocally(photo: PhotoData): void {
  const photos = getLocalPhotos();
  // Éviter les doublons
  const idx = photos.findIndex((p) => p.id === photo.id);
  if (idx >= 0) {
    photos[idx] = photo;
  } else {
    photos.push(photo);
  }
  localStorage.setItem(LOCAL_PHOTOS_KEY, JSON.stringify(photos));
}

/**
 * Récupère toutes les photos locales
 */
export function getLocalPhotos(): PhotoData[] {
  try {
    const raw = localStorage.getItem(LOCAL_PHOTOS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Récupère les photos d'un signalement
 */
export function getPhotosForSignalement(signalementId: string): PhotoData[] {
  return getLocalPhotos().filter((p) => p.signalementId === signalementId);
}

/**
 * Récupère les photos non encore uploadées
 */
export function getUnsyncedPhotos(): PhotoData[] {
  return getLocalPhotos().filter((p) => !p.uploaded);
}

/**
 * Marque une photo comme uploadée (avec URLs full + thumbnail)
 */
export function markPhotoAsUploaded(
  photoId: string, 
  firebaseUrl: string,
  thumbnailUrl?: string
): void {
  const photos = getLocalPhotos();
  const idx = photos.findIndex((p) => p.id === photoId);
  if (idx >= 0) {
    photos[idx].uploaded = true;
    photos[idx].firebaseUrl = firebaseUrl;
    if (thumbnailUrl) {
      photos[idx].thumbnailUrl = thumbnailUrl;
    }
    localStorage.setItem(LOCAL_PHOTOS_KEY, JSON.stringify(photos));
  }
}

/**
 * Supprime une photo locale
 */
export function removeLocalPhoto(photoId: string): void {
  const photos = getLocalPhotos().filter((p) => p.id !== photoId);
  localStorage.setItem(LOCAL_PHOTOS_KEY, JSON.stringify(photos));
}

// ============================================
// SYNCHRONISATION DES PHOTOS
// ============================================

/**
 * Upload toutes les photos non synchronisées vers Firebase Storage
 * Chaque photo = image compressée + miniature
 * Utilisé lors du clic sur le bouton "Synchroniser"
 */
export async function syncAllPhotos(): Promise<{
  uploaded: string[];
  failed: Array<{ id: string; error: string }>;
}> {
  const unsynced = getUnsyncedPhotos();
  const results = { uploaded: [] as string[], failed: [] as Array<{ id: string; error: string }> };

  for (const photo of unsynced) {
    try {
      // Upload image compressée + miniature en parallèle
      const { fullUrl, thumbnailUrl } = await uploadPhotoWithThumbnail(
        photo.signalementId,
        photo.localDataUri,
        photo.thumbnailDataUri,
        photo.fileName
      );
      
      markPhotoAsUploaded(photo.id, fullUrl, thumbnailUrl);
      results.uploaded.push(photo.id);
      
      console.log(`[Photo] Synced ${photo.id}: full=${fullUrl}, thumb=${thumbnailUrl}`);
    } catch (error: any) {
      console.error(`[Photo] Sync failed for ${photo.id}:`, error);
      results.failed.push({ id: photo.id, error: error.message });
    }
  }

  console.log(`[Photo] Sync complete: ${results.uploaded.length} uploaded, ${results.failed.length} failed`);
  return results;
}

/**
 * Prépare et sauvegarde une photo depuis un fichier sélectionné
 * Génère automatiquement une version compressée (1024px) + une miniature (200px)
 * @param file - Fichier image sélectionné
 * @param signalementId - ID du signalement associé
 * @returns PhotoData sauvegardée localement
 */
export async function prepareAndSavePhoto(file: File, signalementId: string): Promise<PhotoData> {
  // Lire le fichier original
  const rawDataUri = await fileToDataUri(file);

  // Compresser l'image principale (1024px max, qualité 0.7, WebP)
  const compressedDataUri = await compressImage(rawDataUri, 1024, 0.7, 'webp');
  
  // Générer la miniature (200px max, qualité 0.6, WebP)
  const thumbnailDataUri = await generateThumbnail(rawDataUri, 200, 0.6);

  // Créer l'objet photo avec les deux versions
  const photo: PhotoData = {
    id: crypto.randomUUID ? crypto.randomUUID() : `photo_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    signalementId,
    firebaseUrl: null,
    thumbnailUrl: null,
    localDataUri: compressedDataUri,
    thumbnailDataUri: thumbnailDataUri,
    fileName: file.name.replace(/\.[^/.]+$/, ''), // sans extension
    fileSize: getDataUriSize(compressedDataUri),
    thumbnailSize: getDataUriSize(thumbnailDataUri),
    uploaded: false,
    createdAt: new Date().toISOString(),
  };

  // Sauvegarder localement
  savePhotoLocally(photo);

  console.log(`[Photo] Prepared: full=${photo.fileSize}B, thumb=${photo.thumbnailSize}B`);
  
  return photo;
}
