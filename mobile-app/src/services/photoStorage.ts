/**
 * Service de stockage local des photos (IndexedDB)
 * Alternative gratuite à Firebase Storage pour le mode offline
 * 
 * Fonctionnement :
 * 1. Compresse les photos avant stockage
 * 2. Stocke dans IndexedDB (pas de limite de taille)
 * 3. Retourne une référence (ID) à stocker dans Firestore/localStorage
 * 4. Synchronise vers le backend quand disponible
 */

const DB_NAME = 'manda_photos';
const DB_VERSION = 1;
const STORE_NAME = 'photos';

interface StoredPhoto {
  id: string;
  signalement_id: string;
  data: string; // base64 compressé
  mimeType: string;
  size: number;
  created_at: string;
  synced: boolean;    
}

let dbPromise: Promise<IDBDatabase> | null = null;

/**
 * Ouvre/initialise la base IndexedDB
 */
function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('[PhotoStorage] Erreur ouverture IndexedDB:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      console.log('[PhotoStorage] IndexedDB ouverte');
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('signalement_id', 'signalement_id', { unique: false });
        store.createIndex('synced', 'synced', { unique: false });
        console.log('[PhotoStorage] Object store créé');
      }
    };
  });

  return dbPromise;
}

/**
 * Compresse une image base64 (réduit qualité et dimensions)
 * @param base64 - Image en base64 (data URL)
 * @param maxWidth - Largeur max (default 1200px)
 * @param quality - Qualité JPEG (0-1, default 0.7)
 * @returns Promise<string> - Image compressée en base64
 */
export async function compressImage(
  base64: string,
  maxWidth: number = 1200,
  quality: number = 0.7
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      // Calculer les dimensions
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }

      // Créer un canvas pour la compression
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas 2D context not available'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      // Convertir en JPEG compressé
      const compressed = canvas.toDataURL('image/jpeg', quality);
      
      const originalSize = base64.length;
      const compressedSize = compressed.length;
      const ratio = ((1 - compressedSize / originalSize) * 100).toFixed(1);
      console.log(`[PhotoStorage] Compression: ${originalSize} → ${compressedSize} bytes (-${ratio}%)`);

      resolve(compressed);
    };

    img.onerror = () => {
      reject(new Error('Failed to load image for compression'));
    };

    img.src = base64;
  });
}

/**
 * Génère un ID unique pour une photo
 */
function generatePhotoId(): string {
  return `photo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Sauvegarde une photo dans IndexedDB (compressée)
 * @param signalementId - ID du signalement associé
 * @param base64Data - Image en base64
 * @returns Promise<string> - ID de la photo stockée
 */
export async function savePhoto(signalementId: string, base64Data: string): Promise<string> {
  const db = await openDB();
  
  // Compresser l'image
  let compressed: string;
  try {
    compressed = await compressImage(base64Data);
  } catch (err) {
    console.warn('[PhotoStorage] Compression échouée, utilisation originale:', err);
    compressed = base64Data;
  }

  const photoId = generatePhotoId();
  const photo: StoredPhoto = {
    id: photoId,
    signalement_id: signalementId,
    data: compressed,
    mimeType: 'image/jpeg',
    size: compressed.length,
    created_at: new Date().toISOString(),
    synced: false,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.add(photo);

    request.onsuccess = () => {
      console.log('[PhotoStorage] Photo sauvegardée:', photoId);
      resolve(photoId);
    };

    request.onerror = () => {
      console.error('[PhotoStorage] Erreur sauvegarde:', request.error);
      reject(request.error);
    };
  });
}

/**
 * Sauvegarde plusieurs photos et retourne les IDs
 */
export async function savePhotos(signalementId: string, photos: string[]): Promise<string[]> {
  const ids: string[] = [];
  for (const photo of photos) {
    try {
      const id = await savePhoto(signalementId, photo);
      ids.push(id);
    } catch (err) {
      console.warn('[PhotoStorage] Échec sauvegarde photo:', err);
    }
  }
  return ids;
}

/**
 * Récupère une photo par son ID
 */
export async function getPhoto(photoId: string): Promise<StoredPhoto | null> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(photoId);

    request.onsuccess = () => {
      resolve(request.result || null);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

/**
 * Récupère toutes les photos d'un signalement
 */
export async function getPhotosBySignalement(signalementId: string): Promise<StoredPhoto[]> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('signalement_id');
    const request = index.getAll(signalementId);

    request.onsuccess = () => {
      resolve(request.result || []);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

/**
 * Récupère les données base64 des photos à partir de leurs IDs
 */
export async function getPhotosData(photoIds: string[]): Promise<string[]> {
  const photos: string[] = [];
  for (const id of photoIds) {
    try {
      const photo = await getPhoto(id);
      if (photo) {
        photos.push(photo.data);
      }
    } catch (err) {
      console.warn('[PhotoStorage] Échec récupération photo:', id, err);
    }
  }
  return photos;
}

/**
 * Récupère toutes les photos non synchronisées
 */
export async function getUnsyncedPhotos(): Promise<StoredPhoto[]> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('synced');
    const request = index.getAll(IDBKeyRange.only(0)); // 0 = false en IndexedDB

    request.onsuccess = () => {
      // Filtrer manuellement car IndexedDB stocke les booleans différemment
      const photos = (request.result || []).filter((p: StoredPhoto) => !p.synced);
      resolve(photos);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

/**
 * Marque une photo comme synchronisée
 */
export async function markPhotoSynced(photoId: string): Promise<void> {
  const db = await openDB();

  const photo = await getPhoto(photoId);
  if (!photo) return;

  photo.synced = true;

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(photo);

    request.onsuccess = () => {
      console.log('[PhotoStorage] Photo marquée synchronisée:', photoId);
      resolve();
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

/**
 * Supprime une photo
 */
export async function deletePhoto(photoId: string): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(photoId);

    request.onsuccess = () => {
      console.log('[PhotoStorage] Photo supprimée:', photoId);
      resolve();
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

/**
 * Supprime les photos synchronisées pour libérer l'espace
 */
export async function cleanupSyncedPhotos(): Promise<number> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('synced');
    const request = index.openCursor(IDBKeyRange.only(true));

    let count = 0;

    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        cursor.delete();
        count++;
        cursor.continue();
      } else {
        console.log(`[PhotoStorage] ${count} photos synchronisées nettoyées`);
        resolve(count);
      }
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

/**
 * Statistiques du stockage local
 */
export async function getStorageStats(): Promise<{ count: number; totalSize: number; unsyncedCount: number }> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const photos = request.result as StoredPhoto[];
      const totalSize = photos.reduce((sum, p) => sum + p.size, 0);
      const unsyncedCount = photos.filter(p => !p.synced).length;

      resolve({
        count: photos.length,
        totalSize,
        unsyncedCount,
      });
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

/**
 * Met à jour le signalement_id des photos (après création du signalement dans Firestore)
 */
export async function updatePhotosSignalementId(photoIds: string[], newSignalementId: string): Promise<void> {
  const db = await openDB();
  
  for (const photoId of photoIds) {
    try {
      const photo = await getPhoto(photoId);
      if (photo) {
        photo.signalement_id = newSignalementId;
        
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          const request = store.put(photo);
          
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
      }
    } catch (err) {
      console.warn('[PhotoStorage] Échec mise à jour signalement_id:', photoId, err);
    }
  }
  console.log('[PhotoStorage] signalement_id mis à jour pour', photoIds.length, 'photos');
}
