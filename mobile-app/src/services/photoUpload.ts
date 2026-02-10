import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { storage, auth as firebaseAuth } from './firebase';
import { ensureAuthenticated } from './auth';
import { getPhoto } from './photoStorage';

export type PhotoUploadResult = {
  photoId: string;
  path: string;
  downloadURL: string;
};

function sanitizePathSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_');
}

/**
 * Upload a locally stored photo (IndexedDB) to Firebase Storage.
 * Returns downloadURL to store in Firestore.
 */
export async function uploadPhotoToStorage(params: {
  signalementId: string;
  photoId: string;
}): Promise<PhotoUploadResult> {
  await ensureAuthenticated().catch(() => undefined);
  const user = firebaseAuth.currentUser;
  if (!user) throw new Error('Pas d\'utilisateur Firebase');

  const stored = await getPhoto(params.photoId);
  if (!stored) throw new Error('Photo introuvable en local');

  // stored.data is data URL (image/jpeg)
  const uid = sanitizePathSegment(user.uid);
  const signalementId = sanitizePathSegment(params.signalementId);
  const photoId = sanitizePathSegment(params.photoId);

  const path = `photos/${uid}/${signalementId}/${photoId}.jpg`;
  const storageRef = ref(storage, path);

  await uploadString(storageRef, stored.data, 'data_url', {
    contentType: stored.mimeType || 'image/jpeg',
    customMetadata: {
      uid: user.uid,
      signalementId: params.signalementId,
      photoId: params.photoId,
    },
  });

  const downloadURL = await getDownloadURL(storageRef);
  return { photoId: params.photoId, path, downloadURL };
}
