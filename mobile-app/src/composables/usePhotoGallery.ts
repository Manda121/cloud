import { ref } from 'vue';
import { Camera, CameraResultType, CameraSource, Photo } from '@capacitor/camera';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';

export interface UserPhoto {
  filepath: string;
  webviewPath: string;
  base64?: string;
}

const photos = ref<UserPhoto[]>([]);

/**
 * Convertit un Blob en base64 (sans préfixe data:)
 */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onloadend = () => {
      const result = reader.result as string;
      // Enlever le préfixe "data:image/...;base64,"
      resolve(result.split(',')[1] || result);
    };
    reader.readAsDataURL(blob);
  });
}

/**
 * Lit la photo en base64 (web ou natif)
 */
async function readAsBase64(photo: Photo): Promise<string> {
  // Sur le web, utiliser fetch + blob
  if (Capacitor.getPlatform() === 'web' && photo.webPath) {
    const response = await fetch(photo.webPath);
    const blob = await response.blob();
    return blobToBase64(blob);
  }

  // Sur natif (Android/iOS), lire depuis le filesystem
  if (photo.path) {
    const file = await Filesystem.readFile({ path: photo.path });
    return file.data as string;
  }

  throw new Error('Impossible de lire la photo');
}

/**
 * Sauvegarde la photo dans le filesystem et retourne les infos
 */
async function savePhoto(photo: Photo): Promise<UserPhoto> {
  const base64Data = await readAsBase64(photo);
  const fileName = `photo_${Date.now()}.jpeg`;

  const savedFile = await Filesystem.writeFile({
    path: fileName,
    data: base64Data,
    directory: Directory.Data,
  });

  // Convertir le chemin en URL utilisable par <img>
  let webviewPath: string;
  if (Capacitor.getPlatform() === 'web') {
    webviewPath = `data:image/jpeg;base64,${base64Data}`;
  } else {
    webviewPath = Capacitor.convertFileSrc(savedFile.uri);
  }

  return {
    filepath: fileName,
    webviewPath,
    base64: base64Data,
  };
}

/**
 * Ouvre la caméra native et ajoute la photo à la galerie
 */
export async function takePhotoFromCamera(): Promise<UserPhoto | null> {
  try {
    const photo = await Camera.getPhoto({
      resultType: CameraResultType.Uri,
      source: CameraSource.Camera,
      quality: 80,
      allowEditing: false,
    });

    const saved = await savePhoto(photo);
    photos.value.unshift(saved);
    return saved;
  } catch (e: any) {
    console.warn('Camera cancelled or failed', e?.message || e);
    return null;
  }
}

/**
 * Ouvre la galerie pour sélectionner une photo
 */
export async function pickPhotoFromGallery(): Promise<UserPhoto | null> {
  try {
    const photo = await Camera.getPhoto({
      resultType: CameraResultType.Uri,
      source: CameraSource.Photos,
      quality: 80,
    });

    const saved = await savePhoto(photo);
    photos.value.unshift(saved);
    return saved;
  } catch (e: any) {
    console.warn('Gallery picker cancelled or failed', e?.message || e);
    return null;
  }
}

/**
 * Composable principal
 */
export function usePhotoGallery() {
  return {
    photos,
    takePhotoFromCamera,
    pickPhotoFromGallery,
  };
}
