<template>
  <ion-page>
    <ion-header>
      <ion-toolbar color="primary">
        <ion-buttons slot="start">
          <ion-back-button default-href="/carte" text=""></ion-back-button>
        </ion-buttons>
        <ion-title>
          <div class="header-title">
            <ion-icon :icon="viewing ? eyeOutline : addCircleOutline"></ion-icon>
            <span>{{ viewing ? 'Détails' : 'Nouveau signalement' }}</span>
          </div>
        </ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <!-- View mode -->
      <template v-if="viewing">
        <div class="view-container">
          <div class="view-header">
            <div class="status-badge" :class="getStatusClass(remoteData?.id_statut)">
              {{ getStatusText(remoteData?.id_statut) }}
            </div>
            <h2>{{ description || 'Signalement' }}</h2>
          </div>

          <div class="info-cards">
            <div class="info-card">
              <ion-icon :icon="locationOutline"></ion-icon>
              <div class="info-content">
                <span class="info-label">Coordonnées</span>
                <span class="info-value">{{ formatCoordinates() }}</span>
              </div>
            </div>

            <div class="info-card">
              <ion-icon :icon="calendarOutline"></ion-icon>
              <div class="info-content">
                <span class="info-label">Date</span>
                <span class="info-value">{{ formatDate(date_signalement) }}</span>
              </div>
            </div>

            <div class="info-card" v-if="surface_m2">
              <ion-icon :icon="resizeOutline"></ion-icon>
              <div class="info-content">
                <span class="info-label">Surface</span>
                <span class="info-value">{{ surface_m2 }} m²</span>
              </div>
            </div>

            <div class="info-card" v-if="budget">
              <ion-icon :icon="cashOutline"></ion-icon>
              <div class="info-content">
                <span class="info-label">Budget estimé</span>
                <span class="info-value">{{ Number(budget).toLocaleString() }} Ar</span>
              </div>
            </div>
          </div>

          <div class="photo-gallery" v-if="remoteData?.photos?.length">
            <h3>Photos</h3>
            <div class="photos-grid">
              <div class="photo-thumb" v-for="(p, idx) in remoteData.photos" :key="idx">
                <img :src="getPhotoUrl(p)" @error="onPhotoError($event)" />
              </div>
            </div>
          </div>

          <!-- Changer le statut -->
          <div class="status-change-section">
            <h3 class="section-title">
              <ion-icon :icon="swapHorizontalOutline"></ion-icon>
              Changer le statut
            </h3>
            <div class="status-options">
              <button 
                v-for="s in statusOptions" 
                :key="s.id" 
                class="status-option-btn" 
                :class="{ active: newStatusId === s.id, [s.cssClass]: true }"
                @click="newStatusId = s.id"
              >
                <ion-icon :icon="s.icon"></ion-icon>
                <span>{{ s.label }}</span>
              </button>
            </div>
            <ion-button 
              expand="block" 
              :disabled="statusUpdating || newStatusId === remoteData?.id_statut" 
              @click="updateStatus"
              class="save-status-btn"
            >
              <ion-spinner v-if="statusUpdating" name="crescent"></ion-spinner>
              <template v-else>
                <ion-icon :icon="checkmarkCircleOutline" slot="start"></ion-icon>
                Enregistrer le changement
              </template>
            </ion-button>
            <div v-if="statusSuccess && !statusOfflineMsg" class="alert alert-success">
              <ion-icon :icon="checkmarkCircleOutline"></ion-icon>
              Statut mis à jour avec succès !
            </div>
            <div v-if="statusSuccess && statusOfflineMsg" class="alert alert-offline">
              <ion-icon :icon="cloudOfflineOutline"></ion-icon>
              {{ statusOfflineMsg }}
            </div>
            <div v-if="statusError" class="alert alert-error">
              <ion-icon :icon="alertCircleOutline"></ion-icon>
              {{ statusError }}
            </div>
          </div>

          <div class="action-buttons">
            <ion-button expand="block" @click="goBack">
              <ion-icon :icon="arrowBackOutline" slot="start"></ion-icon>
              Retour à la carte
            </ion-button>
          </div>
        </div>
      </template>

      <!-- Create mode -->
      <template v-else>
        <div class="form-container">
          <div class="form-header">
            <div class="location-preview">
              <ion-icon :icon="locationOutline"></ion-icon>
              <div>
                <span class="location-label">Position sélectionnée</span>
                <span class="location-coords">{{ lat.toFixed(6) }}, {{ lng.toFixed(6) }}</span>
              </div>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">
              <ion-icon :icon="documentTextOutline"></ion-icon>
              Photos (vous pouvez en ajouter plusieurs)
            </label>
            <div class="photo-actions">
              <ion-button size="small" color="primary" @click="takePhoto">
                <ion-icon :icon="cameraOutline" slot="start"></ion-icon>
                Prendre une photo
              </ion-button>
              <ion-button size="small" fill="outline" @click="openGallery">
                Ajouter depuis la galerie
              </ion-button>
            </div>

            <!-- Hidden inputs: one for camera capture (single), one for gallery (multiple) -->
            <input ref="cameraInput" type="file" accept="image/*" capture="environment" @change="onFilesSelected" style="display:none" />
            <input ref="galleryInput" type="file" accept="image/*" multiple @change="onFilesSelected" style="display:none" />

            <div class="photos-preview" v-if="selectedPreviews.length">
              <div class="photo-thumb" v-for="(p, i) in selectedPreviews" :key="i">
                <img :src="p" />
                <button type="button" class="remove-photo" @click="removePreview(i)">✕</button>
              </div>
            </div>
          </div>

          <form @submit.prevent="onSubmit">
            <div class="form-group">
              <label class="form-label">
                <ion-icon :icon="documentTextOutline"></ion-icon>
                Description de la dégradation
              </label>
              <ion-textarea 
                v-model="description" 
                :rows="4" 
                placeholder="Décrivez l'état de la route (nid de poule, fissure, affaissement...)"
                class="custom-textarea"
              />
            </div>

            <div class="form-row">
              <div class="form-group half">
                <label class="form-label">
                  <ion-icon :icon="resizeOutline"></ion-icon>
                  Surface (m²)
                </label>
                <ion-input 
                  type="number" 
                  v-model.number="surface_m2" 
                  placeholder="Ex: 5"
                  class="custom-input"
                />
              </div>

              <div class="form-group half">
                <label class="form-label">
                  <ion-icon :icon="cashOutline"></ion-icon>
                  Budget (Ar)
                </label>
                <ion-input 
                  type="number" 
                  step="0.01" 
                  v-model.number="budget" 
                  placeholder="Ex: 50000"
                  class="custom-input"
                />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">
                <ion-icon :icon="calendarOutline"></ion-icon>
                Date du signalement
              </label>
              <ion-datetime 
                v-model="date_signalement" 
                presentation="date"
                class="custom-datetime"
              ></ion-datetime>
            </div>

            <div v-if="errorMsg" class="alert alert-error">
              <ion-icon :icon="alertCircleOutline"></ion-icon>
              {{ errorMsg }}
            </div>

            <div v-if="saved" class="alert alert-success">
              <ion-icon :icon="checkmarkCircleOutline"></ion-icon>
              Signalement enregistré avec succès !
            </div>

            <div class="action-buttons">
              <ion-button expand="block" type="submit" :disabled="loading" class="submit-btn">
                <ion-spinner v-if="loading" name="crescent"></ion-spinner>
                <template v-else>
                  <ion-icon :icon="sendOutline" slot="start"></ion-icon>
                  Enregistrer le signalement
                </template>
              </ion-button>
              <ion-button expand="block" fill="outline" color="medium" @click="goBack" type="button">
                Annuler
              </ion-button>
            </div>
          </form>
        </div>
      </template>

      <!-- Webcam capture modal (pour PC/navigateur) -->
      <WebcamCapture 
        :isOpen="showWebcam" 
        @close="showWebcam = false" 
        @captured="onWebcamCaptured" 
      />
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { 
  IonButton, IonContent, IonHeader, IonInput, IonPage, IonTextarea, 
  IonTitle, IonToolbar, IonDatetime, IonButtons, IonBackButton, IonIcon, IonSpinner
} from '@ionic/vue';
import { 
  eyeOutline, addCircleOutline, locationOutline, calendarOutline, 
  resizeOutline, cashOutline, arrowBackOutline, documentTextOutline,
  alertCircleOutline, checkmarkCircleOutline, sendOutline, cameraOutline,
  swapHorizontalOutline, alertOutline, timeOutline, checkmarkDoneOutline,
  cloudOfflineOutline
} from 'ionicons/icons';
import { createSignalement, getSignalementById, getLocalSignalements, saveLocalSignalement, updateLocalSignalement } from '../services/signalement';
import { getBackendUrl } from '../services/backend';
import { getAuthToken, ensureAuthenticated, isAnonymousUser } from '../services/auth';
import { addPendingStatusUpdate } from '../services/sync';
import { db } from '../services/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { takePhotoFromCamera, pickPhotoFromGallery } from '../composables/usePhotoGallery';
import { Capacitor } from '@capacitor/core';
import WebcamCapture from '../components/WebcamCapture.vue';

const route = useRoute();
const router = useRouter();

const lat = computed(() => Number.parseFloat((route.query.lat as string) || '0'));
const lng = computed(() => Number.parseFloat((route.query.lng as string) || '0'));

const description = ref('');
const surface_m2 = ref<number | null>(null);
const budget = ref<number | null>(null);
const date_signalement = ref<string>(new Date().toISOString().slice(0, 10));
const saved = ref(false);
const viewing = ref(false);
const remoteData = ref<any | null>(null);
const errorMsg = ref<string | null>(null);
const loading = ref(false);
const selectedFiles = ref<File[]>([]);
const selectedPreviews = ref<string[]>([]);
const cameraInput = ref<HTMLInputElement | null>(null);
const galleryInput = ref<HTMLInputElement | null>(null);
const showWebcam = ref(false);
const newStatusId = ref<number>(1);
const statusUpdating = ref(false);
const statusSuccess = ref(false);
const statusError = ref<string | null>(null);
const statusOfflineMsg = ref<string | null>(null);

const statusOptions = [
  { id: 1, label: 'Nouveau', cssClass: 'opt-nouveau', icon: alertOutline },
  { id: 2, label: 'En cours', cssClass: 'opt-encours', icon: timeOutline },
  { id: 3, label: 'Terminé', cssClass: 'opt-termine', icon: checkmarkDoneOutline },
];

onMounted(async () => {
  const id = (route.query.id as string) || null;
  if (id) {
    viewing.value = true;
    try {
      const data = await getSignalementById(id);
      remoteData.value = data;
      description.value = data.description ?? '';
      surface_m2.value = data.surface_m2 ?? null;
      budget.value = data.budget ?? null;
      date_signalement.value = data.date_signalement ?? date_signalement.value;
      newStatusId.value = data.id_statut ?? 1;
    } catch (err: any) {
      console.warn('Fetch signalement failed', err);
      const locals = getLocalSignalements();
      const local = locals.find((s: any) => s.id_signalement === id);
      if (local) {
        remoteData.value = local;
        description.value = local.description ?? '';
        surface_m2.value = local.surface_m2 ?? null;
        budget.value = local.budget ?? null;
        date_signalement.value = local.date_signalement ?? date_signalement.value;
        newStatusId.value = local.id_statut ?? 1;
      }
    }
  }
});

function formatCoordinates() {
  // Utiliser latitude/longitude renvoyés par l'API
  if (remoteData.value?.latitude && remoteData.value?.longitude) {
    return `${Number(remoteData.value.latitude).toFixed(6)}, ${Number(remoteData.value.longitude).toFixed(6)}`;
  }
  // Fallback: essayer geom_geojson
  if (remoteData.value?.geom_geojson) {
    try {
      const coords = JSON.parse(remoteData.value.geom_geojson)?.coordinates;
      return `${coords[1].toFixed(6)}, ${coords[0].toFixed(6)}`;
    } catch { }
  }
  // Fallback: essayer geom (objet GeoJSON local)
  if (remoteData.value?.geom?.coordinates) {
    const coords = remoteData.value.geom.coordinates;
    return `${coords[1].toFixed(6)}, ${coords[0].toFixed(6)}`;
  }
  return `${lat.value.toFixed(6)}, ${lng.value.toFixed(6)}`;
}

function formatDate(dateStr: string) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function getStatusClass(statusId: number) {
  switch (statusId) {
    case 1: return 'status-nouveau';
    case 2: return 'status-encours';
    case 3: return 'status-termine';
    default: return 'status-nouveau';
  }
}

function getStatusText(statusId: number) {
  switch (statusId) {
    case 1: return 'Nouveau';
    case 2: return 'En cours';
    case 3: return 'Terminé';
    default: return 'Nouveau';
  }
}

function getPhotoUrl(p: any): string {
  // Base64 ou data URL (photos locales)
  if (typeof p === 'string') {
    if (p.startsWith('data:') || p.startsWith('http')) return p;
    // Si c'est un chemin relatif commençant par /uploads
    if (p.startsWith('/')) return getBackendUrl() + p;
    return p;
  }
  // Objet { url, filename, ... } retourné par l'API
  if (p && p.url) {
    if (p.url.startsWith('http')) return p.url;
    return getBackendUrl() + p.url;
  }
  return '';
}

function onPhotoError(event: Event) {
  const img = event.target as HTMLImageElement;
  img.style.display = 'none';
}

async function onSubmit() {
  errorMsg.value = null;
  loading.value = true;

  // Assurer qu'un utilisateur (même anonyme) est connecté
  let token: string | null = null;
  try {
    token = await ensureAuthenticated();
  } catch {
    // Mode totalement offline : on continue sans token
    token = getAuthToken();
  }

  const localId = (crypto as any).randomUUID ? (crypto as any).randomUUID() : String(Date.now());
  
  const localSignalement = {
    id_signalement: localId,
    description: description.value,
    surface_m2: surface_m2.value,
    budget: budget.value,
    date_signalement: date_signalement.value,
    geom: {
      type: 'Point',
      coordinates: [lng.value, lat.value]
    },
    photos: selectedPreviews.value,
    source: 'LOCAL' as const,
    synced: false,
    id_statut: 1, // Par défaut 'Nouveau'
    created_at: new Date().toISOString()
  };
  saveLocalSignalement(localSignalement);

  try {
    const created = await createSignalement({
      description: description.value,
      latitude: lat.value,
      longitude: lng.value,
      surface_m2: surface_m2.value ?? undefined,
      budget: budget.value ?? undefined,
      photos: selectedPreviews.value.length ? selectedPreviews.value : undefined,
      date_signalement: date_signalement.value,
    });

    updateLocalSignalement(localId, {
      synced: true,
      id_signalement_server: created.id_signalement,
      id_statut: (created.id_statut ?? 1),
    });

    saved.value = true;
    
    try {
      window.dispatchEvent(new CustomEvent('signalement:created', { detail: created }));
    } catch (_) {}

    setTimeout(() => router.push({ name: 'Carte' }), 800);
  } catch (err: any) {
    console.warn('POST signalement failed, saved locally', err);
    errorMsg.value = err.message || 'Erreur lors de l\'envoi. Sauvegardé localement.';
    
    try {
      window.dispatchEvent(new CustomEvent('signalement:created', { detail: localSignalement }));
    } catch (_) {}
    
    saved.value = true;
    setTimeout(() => router.push({ name: 'Carte' }), 900);
  } finally {
    loading.value = false;
  }
}

function onFilesSelected(ev: Event) {
  const input = ev.target as HTMLInputElement;
  if (!input.files) return;

  Array.from(input.files).forEach((file) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      if (result) {
        selectedPreviews.value.push(result);
        selectedFiles.value.push(file);
      }
    };
    reader.readAsDataURL(file);
  });

  // Reset input so same file can be selected again if needed
  input.value = '';
}

function removePreview(idx: number) {
  selectedPreviews.value.splice(idx, 1);
  selectedFiles.value.splice(idx, 1);
}

async function takePhoto() {
  // Sur plateforme native (Android/iOS), utiliser Capacitor Camera
  if (Capacitor.isNativePlatform()) {
    try {
      const photo = await takePhotoFromCamera();
      if (photo) {
        selectedPreviews.value.push(photo.base64 ? `data:image/jpeg;base64,${photo.base64}` : photo.webviewPath);
        return;
      }
    } catch (e) {
      console.warn('Native camera failed', e);
    }
    // Fallback natif
    cameraInput.value?.click();
    return;
  }

  // Sur le web (PC), ouvrir le modal webcam
  const canUseWebcam = typeof navigator !== 'undefined'
    && typeof navigator.mediaDevices?.getUserMedia === 'function';
  if (canUseWebcam) {
    showWebcam.value = true;
  } else {
    // Fallback si pas de webcam API
    cameraInput.value?.click();
  }
}

function onWebcamCaptured(dataUrl: string) {
  selectedPreviews.value.push(dataUrl);
}

async function openGallery() {
  try {
    // Essayer d'utiliser le sélecteur natif (Capacitor)
    const photo = await pickPhotoFromGallery();
    if (photo) {
      selectedPreviews.value.push(photo.base64 ? `data:image/jpeg;base64,${photo.base64}` : photo.webviewPath);
      return;
    }
  } catch (e) {
    console.warn('Native gallery not available, falling back to input', e);
  }
  // Fallback: utiliser l'input file standard
  galleryInput.value?.click();
}

async function updateStatus() {
  const sig = remoteData.value;
  if (!sig?.id_signalement) return;
  statusUpdating.value = true;
  statusSuccess.value = false;
  statusError.value = null;

  const isLocal = sig.source === 'LOCAL' && !sig.synced;

  // Si le signalement est local et non synchronisé, on met à jour localement
  if (isLocal) {
    try {
      updateLocalSignalement(sig.id_signalement, { id_statut: newStatusId.value });
      remoteData.value.id_statut = newStatusId.value;
      statusSuccess.value = true;
      setTimeout(() => { statusSuccess.value = false; }, 3000);
    } catch (err: any) {
      statusError.value = 'Erreur lors de la mise à jour locale';
      setTimeout(() => { statusError.value = null; }, 4000);
    } finally {
      statusUpdating.value = false;
    }
    return;
  }

  // Utiliser l'ID serveur si disponible, sinon l'ID local
  const serverId = sig.id_signalement_server || sig.id_signalement;

  try {
    const token = getAuthToken();
    if (!token) {
      statusError.value = 'Vous devez être connecté';
      statusUpdating.value = false;
      return;
    }
    const backendUrl = getBackendUrl();
    console.log('updateStatus -> PUT', `${backendUrl}/api/signalements/${serverId}`, { id_statut: newStatusId.value });
    const response = await fetch(`${backendUrl}/api/signalements/${serverId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ id_statut: newStatusId.value })
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      console.error('updateStatus error response:', response.status, body);

      // Si 404, fallback local
      if (response.status === 404) {
        updateLocalSignalement(sig.id_signalement, { id_statut: newStatusId.value });
        remoteData.value.id_statut = newStatusId.value;
        statusSuccess.value = true;
        statusError.value = null;
        setTimeout(() => { statusSuccess.value = false; }, 3000);
        statusUpdating.value = false;
        return;
      }
      throw new Error(body.error || `Erreur ${response.status}`);
    }

    await response.json();
    remoteData.value.id_statut = newStatusId.value;
    statusSuccess.value = true;
    // Notifier le sidebar pour rafraîchir le compteur de notifications
    window.dispatchEvent(new CustomEvent('notifications:updated'));
    setTimeout(() => { statusSuccess.value = false; }, 3000);
  } catch (err: any) {
    console.error('updateStatus catch:', err);

    // Si le backend est indisponible mais le signalement existe dans Firestore,
    // écrire le nouveau statut directement dans Firestore (mode offline)
    if (sig.source === 'FIREBASE' && sig.id_signalement) {
      try {
        await updateDoc(doc(db, 'signalements', sig.id_signalement), { id_statut: newStatusId.value, synced: false });
        remoteData.value.id_statut = newStatusId.value;
        
        // Ajouter à la file d'attente pour sync ultérieure
        addPendingStatusUpdate({
          signalement_id: sig.id_signalement,
          firestore_id: sig.id_signalement,
          new_status: newStatusId.value,
          source: 'FIREBASE',
        });
        
        statusSuccess.value = true;
        statusOfflineMsg.value = 'Sauvegardé hors-ligne. Sera synchronisé automatiquement.';
        // Notifier le sidebar pour rafraîchir le compteur de notifications
        window.dispatchEvent(new CustomEvent('notifications:updated'));
        setTimeout(() => { statusSuccess.value = false; statusOfflineMsg.value = null; }, 4000);
        statusUpdating.value = false;
        return;
      } catch (dbErr: any) {
        console.error('Failed to update Firestore fallback:', dbErr);
      }
    }
    
    // Fallback local storage pour signalements locaux
    if (sig.source === 'LOCAL' || sig.id_signalement) {
      try {
        updateLocalSignalement(sig.id_signalement, { id_statut: newStatusId.value });
        remoteData.value.id_statut = newStatusId.value;
        
        addPendingStatusUpdate({
          signalement_id: sig.id_signalement,
          new_status: newStatusId.value,
          source: 'LOCAL',
        });
        
        statusSuccess.value = true;
        statusOfflineMsg.value = 'Sauvegardé localement. Sera synchronisé quand le serveur sera disponible.';
        setTimeout(() => { statusSuccess.value = false; statusOfflineMsg.value = null; }, 4000);
        statusUpdating.value = false;
        return;
      } catch {
        // Continue to error
      }
    }

    statusError.value = err.message || 'Erreur inconnue';
    setTimeout(() => { statusError.value = null; }, 4000);
  } finally {
    statusUpdating.value = false;
  }
}

function goBack() {
  router.back();
}
</script>

<style scoped>
.header-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-title ion-icon {
  font-size: 22px;
}

/* View Mode Styles */
.view-container {
  padding: 20px;
  max-width: 680px;
  margin: 0 auto;
}

.view-header {
  text-align: center;
  margin-bottom: 28px;
  padding: 24px 20px;
  background: white;
  border-radius: 20px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}

.view-header h2 {
  margin: 16px 0 0;
  font-size: 20px;
  font-weight: 700;
  color: #1a202c;
  line-height: 1.3;
}

.status-badge {
  display: inline-block;
  padding: 6px 20px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.status-nouveau {
  background: linear-gradient(135deg, #f5576c 0%, #f093fb 100%);
  color: white;
  box-shadow: 0 3px 10px rgba(245, 87, 108, 0.3);
}

.status-encours {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
  color: white;
  box-shadow: 0 3px 10px rgba(79, 172, 254, 0.3);
}

.status-termine {
  background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
  color: white;
  box-shadow: 0 3px 10px rgba(67, 233, 123, 0.3);
}

.info-cards {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 24px;
}

.info-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 18px 20px;
  background: white;
  border-radius: 16px;
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.05);
  border: 1px solid #f0f4f8;
  transition: all 0.2s ease;
}

.info-card:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  transform: translateY(-1px);
}

.info-card ion-icon {
  font-size: 26px;
  color: #667eea;
  flex-shrink: 0;
  padding: 10px;
  border-radius: 12px;
  background: rgba(102, 126, 234, 0.08);
}

.info-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.info-label {
  font-size: 11px;
  color: #a0aec0;
  text-transform: uppercase;
  font-weight: 700;
  letter-spacing: 0.5px;
}

.info-value {
  font-size: 16px;
  font-weight: 600;
  color: #1a202c;
  line-height: 1.3;
}

/* Form Mode Styles */
.form-container {
  padding: 20px;
  max-width: 680px;
  margin: 0 auto;
}

.form-header {
  margin-bottom: 24px;
}

.location-preview {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 16px;
  color: white;
  box-shadow: 0 4px 16px rgba(102, 126, 234, 0.35);
}

.location-preview ion-icon {
  font-size: 32px;
  filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));
}

.location-label {
  display: block;
  font-size: 11px;
  opacity: 0.85;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 600;
}

.location-coords {
  display: block;
  font-size: 16px;
  font-weight: 700;
  margin-top: 2px;
}

.form-group {
  margin-bottom: 22px;
}

.form-row {
  display: flex;
  gap: 16px;
}

.form-group.half {
  flex: 1;
}

.form-label {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 700;
  color: #4a5568;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.form-label ion-icon {
  font-size: 16px;
  color: #667eea;
}

.custom-textarea,
.custom-input {
  --background: #ffffff !important;
  --color: #2d3748 !important;
  --placeholder-color: #a0aec0 !important;
  --placeholder-opacity: 1 !important;
  --border-radius: 12px;
  --padding-start: 16px;
  --padding-end: 16px;
  border: 2px solid #d1d9e6 !important;
  border-radius: 12px;
  background: #ffffff !important;
  color: #2d3748 !important;
  font-size: 15px;
}

.custom-textarea:focus-within,
.custom-input:focus-within {
  border-color: #667eea !important;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.12);
}

.custom-datetime {
  --background: #ffffff;
  --background-rgb: 255, 255, 255;
  border: 2px solid #d1d9e6;
  border-radius: 12px;
  padding: 8px;
  color: #2d3748;
}

.photo-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
  margin-bottom: 8px;
}

.photos-preview {
  display: flex;
  gap: 12px;
  margin-top: 12px;
  flex-wrap: wrap;
}

.photo-thumb {
  position: relative;
  width: 92px;
  height: 92px;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

.photo-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.remove-photo {
  position: absolute;
  top: 4px;
  right: 4px;
  background: rgba(0,0,0,0.6);
  color: white;
  border: none;
  border-radius: 12px;
  width: 22px;
  height: 22px;
  cursor: pointer;
  font-size: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.photo-gallery h3 { margin: 12px 0 8px; color: #2d3748; }
.photos-grid { display:flex; gap:12px; flex-wrap:wrap; }

.alert {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  border-radius: 12px;
  margin-bottom: 20px;
  font-size: 14px;
  font-weight: 500;
}

.alert ion-icon {
  font-size: 22px;
  flex-shrink: 0;
}

.alert-error {
  background: #fff5f5;
  color: #c53030;
  border: 1px solid #fed7d7;
}

.alert-success {
  background: #f0fff4;
  color: #2f855a;
  border: 1px solid #c6f6d5;
}

.alert-offline {
  background: #fffbeb;
  color: #b45309;
  border: 1px solid #fde68a;
}

.action-buttons {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 28px;
}

.action-buttons ion-button {
  --border-radius: 14px;
  height: 52px;
  font-weight: 700;
  font-size: 15px;
  letter-spacing: 0.3px;
}

.submit-btn {
  --background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  box-shadow: 0 4px 16px rgba(102, 126, 234, 0.35);
}

/* ============================
   STATUS CHANGE SECTION
   ============================ */
.status-change-section {
  margin-top: 28px;
  padding: 20px;
  background: white;
  border-radius: 16px;
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.05);
  border: 1px solid #f0f4f8;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 16px;
  font-size: 16px;
  font-weight: 700;
  color: #2d3748;
}

.section-title ion-icon {
  font-size: 20px;
  color: #667eea;
}

.status-options {
  display: flex;
  gap: 10px;
  margin-bottom: 18px;
}

.status-option-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 14px 8px;
  border: 2px solid #e2e8f0;
  border-radius: 14px;
  background: #f8fafc;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 12px;
  font-weight: 600;
  color: #718096;
}

.status-option-btn ion-icon {
  font-size: 22px;
}

.status-option-btn:hover {
  border-color: #cbd5e0;
  background: #f0f4f8;
}

/* Nouveau */
.status-option-btn.opt-nouveau.active {
  border-color: #f5576c;
  background: linear-gradient(135deg, rgba(245,87,108,0.08) 0%, rgba(240,147,251,0.08) 100%);
  color: #e53e3e;
}
.status-option-btn.opt-nouveau.active ion-icon {
  color: #f5576c;
}

/* En cours */
.status-option-btn.opt-encours.active {
  border-color: #4facfe;
  background: linear-gradient(135deg, rgba(79,172,254,0.08) 0%, rgba(0,242,254,0.08) 100%);
  color: #2b6cb0;
}
.status-option-btn.opt-encours.active ion-icon {
  color: #4facfe;
}

/* Terminé */
.status-option-btn.opt-termine.active {
  border-color: #43e97b;
  background: linear-gradient(135deg, rgba(67,233,123,0.08) 0%, rgba(56,249,215,0.08) 100%);
  color: #276749;
}
.status-option-btn.opt-termine.active ion-icon {
  color: #43e97b;
}

.save-status-btn {
  --background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  --border-radius: 12px;
  height: 48px;
  font-weight: 700;
  margin-bottom: 12px;
  box-shadow: 0 4px 14px rgba(102, 126, 234, 0.3);
}

.save-status-btn[disabled] {
  opacity: 0.5;
  box-shadow: none;
}
</style>
