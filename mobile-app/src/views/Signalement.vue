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
  alertCircleOutline, checkmarkCircleOutline, sendOutline
} from 'ionicons/icons';
import { createSignalement, getSignalementById, getLocalSignalements, saveLocalSignalement, updateLocalSignalement } from '../services/signalement';
import { getAuthToken } from '../services/auth';

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
      }
    }
  }
});

function formatCoordinates() {
  if (remoteData.value?.geom_geojson) {
    try {
      const coords = JSON.parse(remoteData.value.geom_geojson)?.coordinates;
      return `${coords[1].toFixed(6)}, ${coords[0].toFixed(6)}`;
    } catch { }
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

async function onSubmit() {
  errorMsg.value = null;
  loading.value = true;

  const token = getAuthToken();
  if (!token) {
    errorMsg.value = 'Vous devez être connecté pour créer un signalement';
    loading.value = false;
    return;
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
    source: 'LOCAL' as const,
    synced: false,
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
      date_signalement: date_signalement.value,
    });

    updateLocalSignalement(localId, {
      synced: true,
      id_signalement_server: created.id_signalement,
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
}

.view-header {
  text-align: center;
  margin-bottom: 24px;
}

.view-header h2 {
  margin: 16px 0 0;
  font-size: 20px;
  color: #2d3748;
}

.status-badge {
  display: inline-block;
  padding: 6px 16px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
}

.status-nouveau {
  background: linear-gradient(135deg, #f5576c 0%, #f093fb 100%);
  color: white;
}

.status-encours {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
  color: white;
}

.status-termine {
  background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
  color: white;
}

.info-cards {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 24px;
}

.info-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.info-card ion-icon {
  font-size: 28px;
  color: #667eea;
}

.info-content {
  display: flex;
  flex-direction: column;
}

.info-label {
  font-size: 12px;
  color: #718096;
  text-transform: uppercase;
}

.info-value {
  font-size: 16px;
  font-weight: 600;
  color: #2d3748;
}

/* Form Mode Styles */
.form-container {
  padding: 20px;
}

.form-header {
  margin-bottom: 24px;
}

.location-preview {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  color: white;
}

.location-preview ion-icon {
  font-size: 32px;
}

.location-label {
  display: block;
  font-size: 12px;
  opacity: 0.9;
}

.location-coords {
  display: block;
  font-size: 16px;
  font-weight: 600;
}

.form-group {
  margin-bottom: 20px;
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
  font-size: 14px;
  font-weight: 600;
  color: #4a5568;
}

.form-label ion-icon {
  font-size: 18px;
  color: #667eea;
}

.custom-textarea,
.custom-input {
  --background: #f7fafc;
  --border-radius: 12px;
  --padding-start: 16px;
  --padding-end: 16px;
  --color: #000000;
  color: #000000;
  border: 2px solid #e2e8f0;
  border-radius: 12px;
}

.custom-textarea:focus-within,
.custom-input:focus-within {
  border-color: #667eea;
}

.custom-datetime {
  --background: #f7fafc;
  border: 2px solid #e2e8f0;
  border-radius: 12px;
  padding: 8px;
}

.alert {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  border-radius: 12px;
  margin-bottom: 20px;
}

.alert ion-icon {
  font-size: 24px;
}

.alert-error {
  background: #fed7d7;
  color: #c53030;
}

.alert-success {
  background: #c6f6d5;
  color: #2f855a;
}

.action-buttons {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 24px;
}

.action-buttons ion-button {
  --border-radius: 12px;
  height: 50px;
  font-weight: 600;
}

.submit-btn {
  --background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}
</style>
