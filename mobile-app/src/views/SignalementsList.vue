<template>
  <ion-page>
    <ion-header>
      <ion-toolbar color="primary">
        <ion-buttons slot="start">
          <ion-menu-button></ion-menu-button>
        </ion-buttons>
        <ion-title>Liste des Signalements</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="refreshList">
            <ion-icon :icon="refreshOutline"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <!-- Statistiques rapides -->
      <div class="stats-cards" v-if="stats">
        <div class="stat-card">
          <div class="stat-value">{{ stats.total }}</div>
          <div class="stat-label">Total</div>
        </div>
        <div class="stat-card stat-nouveau">
          <div class="stat-value">{{ stats.par_statut?.nouveau || 0 }}</div>
          <div class="stat-label">Nouveaux</div>
        </div>
        <div class="stat-card stat-encours">
          <div class="stat-value">{{ stats.par_statut?.en_cours || 0 }}</div>
          <div class="stat-label">En cours</div>
        </div>
        <div class="stat-card stat-termine">
          <div class="stat-value">{{ stats.par_statut?.termine || 0 }}</div>
          <div class="stat-label">Terminés</div>
        </div>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="loading-container">
        <ion-spinner name="crescent"></ion-spinner>
        <p>Chargement des signalements...</p>
      </div>

      <!-- Liste vide -->
      <div v-else-if="signalements.length === 0" class="empty-state">
        <ion-icon :icon="alertCircleOutline" class="empty-icon"></ion-icon>
        <h3>Aucun signalement</h3>
        <p>Cliquez sur la carte pour créer votre premier signalement.</p>
        <ion-button @click="goToCarte">
          <ion-icon :icon="mapOutline" slot="start"></ion-icon>
          Aller à la carte
        </ion-button>
      </div>

      <!-- Liste des signalements -->
      <ion-list v-else class="signalements-list">
        <ion-item-sliding v-for="s in signalements" :key="s.id_signalement">
          <ion-item @click="viewSignalement(s)" class="signalement-item" :class="getStatusClass(s.id_statut)">
            <ion-icon :icon="locationOutline" slot="start" class="location-icon"></ion-icon>
            <ion-label>
              <h2>{{ truncate(s.description, 50) }}</h2>
              <p class="meta">
                <span class="date">📅 {{ formatDate(s.date_signalement) }}</span>
                <span class="coords">📍 {{ s.latitude?.toFixed(4) }}, {{ s.longitude?.toFixed(4) }}</span>
              </p>
              <p class="details">
                <ion-badge :color="getStatusColor(s.id_statut)">{{ getStatusLabel(s.id_statut) }}</ion-badge>
                <span v-if="s.surface_m2" class="surface">{{ s.surface_m2 }} m²</span>
                <span v-if="s.budget" class="budget">{{ formatBudget(s.budget) }} Ar</span>
              </p>
            </ion-label>
            <ion-icon :icon="chevronForwardOutline" slot="end"></ion-icon>
          </ion-item>

          <!-- Actions slide -->
          <ion-item-options side="end">
            <ion-item-option color="primary" @click="editSignalement(s)">
              <ion-icon :icon="createOutline" slot="icon-only"></ion-icon>
            </ion-item-option>
            <ion-item-option color="danger" @click="confirmDelete(s)">
              <ion-icon :icon="trashOutline" slot="icon-only"></ion-icon>
            </ion-item-option>
          </ion-item-options>
        </ion-item-sliding>
      </ion-list>

      <!-- FAB pour ajouter -->
      <ion-fab vertical="bottom" horizontal="end" slot="fixed">
        <ion-fab-button @click="goToCarte">
          <ion-icon :icon="addOutline"></ion-icon>
        </ion-fab-button>
      </ion-fab>

      <!-- Modal d'édition -->
      <ion-modal :is-open="editModalOpen" @didDismiss="editModalOpen = false">
        <ion-header>
          <ion-toolbar color="primary">
            <ion-title>Modifier le signalement</ion-title>
            <ion-buttons slot="end">
              <ion-button @click="editModalOpen = false">Fermer</ion-button>
            </ion-buttons>
          </ion-toolbar>
        </ion-header>
        <ion-content class="ion-padding modal-content" v-if="editingSignalement">
          <div class="modal-form">
            <div class="modal-form-group">
              <label class="modal-label">Description</label>
              <ion-textarea 
                v-model="editingSignalement.description" 
                :rows="4"
                class="modal-input"
                placeholder="Description du signalement..."
              ></ion-textarea>
            </div>
            <div class="modal-form-group">
              <label class="modal-label">Surface (m²)</label>
              <ion-input 
                type="number" 
                v-model.number="editingSignalement.surface_m2"
                class="modal-input"
                placeholder="Ex: 10"
              ></ion-input>
            </div>
            <div class="modal-form-group">
              <label class="modal-label">Budget (Ar)</label>
              <ion-input 
                type="number" 
                v-model.number="editingSignalement.budget"
                class="modal-input"
                placeholder="Ex: 50000"
              ></ion-input>
            </div>
            <div class="modal-form-group">
              <label class="modal-label">Statut</label>
              <ion-select v-model="editingSignalement.id_statut" class="modal-select" interface="popover">
                <ion-select-option :value="1">Nouveau</ion-select-option>
                <ion-select-option :value="2">En cours</ion-select-option>
                <ion-select-option :value="3">Terminé</ion-select-option>
              </ion-select>
            </div>
          </div>
          <div class="modal-actions">
            <ion-button expand="block" @click="saveEdit" :disabled="saving" class="modal-save-btn">
              {{ saving ? 'Enregistrement...' : 'Enregistrer les modifications' }}
            </ion-button>
          </div>
        </ion-content>
      </ion-modal>

      <!-- Alert de confirmation suppression -->
      <ion-alert
        :is-open="deleteAlertOpen"
        header="Confirmer la suppression"
        message="Êtes-vous sûr de vouloir supprimer ce signalement ?"
        :buttons="deleteAlertButtons"
        @didDismiss="deleteAlertOpen = false"
      ></ion-alert>

      <!-- Toast -->
      <ion-toast
        :is-open="toast.show"
        :message="toast.message"
        :color="toast.color"
        :duration="2000"
        @didDismiss="toast.show = false"
      ></ion-toast>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem,
  IonLabel, IonIcon, IonButton, IonButtons, IonMenuButton, IonBadge,
  IonItemSliding, IonItemOptions, IonItemOption, IonFab, IonFabButton,
  IonModal, IonTextarea, IonInput, IonSelect, IonSelectOption,
  IonAlert, IonToast, IonSpinner
} from '@ionic/vue';
import {
  locationOutline, chevronForwardOutline, createOutline, trashOutline,
  addOutline, refreshOutline, alertCircleOutline, mapOutline
} from 'ionicons/icons';
import { getSignalements, getSignalementsStats, Signalement } from '../services/signalement';
import { getAuthToken } from '../services/auth';
import { getBackendUrl } from '../services/backend';

const router = useRouter();

const signalements = ref<Signalement[]>([]);
const stats = ref<any>(null);
const loading = ref(true);
const editModalOpen = ref(false);
const editingSignalement = ref<Signalement | null>(null);
const saving = ref(false);
const deleteAlertOpen = ref(false);
const signalementToDelete = ref<Signalement | null>(null);
const toast = ref({ show: false, message: '', color: 'success' });

const deleteAlertButtons = [
  { text: 'Annuler', role: 'cancel' },
  { text: 'Supprimer', role: 'destructive', handler: () => deleteSignalement() }
];

onMounted(async () => {
  await loadData();
});

async function loadData() {
  loading.value = true;
  try {
    const [list, statsData] = await Promise.all([
      getSignalements(),
      getSignalementsStats().catch(() => null)
    ]);
    signalements.value = list;
    stats.value = statsData;
  } catch (err: any) {
    console.error('Erreur chargement:', err);
    showToast('Erreur de chargement', 'danger');
  } finally {
    loading.value = false;
  }
}

async function refreshList() {
  await loadData();
  showToast('Liste actualisée', 'success');
}

function viewSignalement(s: Signalement) {
  router.push({ name: 'Signalement', query: { id: s.id_signalement } });
}

function editSignalement(s: Signalement) {
  editingSignalement.value = { ...s };
  editModalOpen.value = true;
}

async function saveEdit() {
  if (!editingSignalement.value) return;
  saving.value = true;
  try {
    const token = getAuthToken();
    const response = await fetch(`${getBackendUrl()}/api/signalements/${editingSignalement.value.id_signalement}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        description: editingSignalement.value.description,
        surface_m2: editingSignalement.value.surface_m2,
        budget: editingSignalement.value.budget,
        id_statut: Number(editingSignalement.value.id_statut)
      })
    });
    if (!response.ok) throw new Error('Erreur lors de la mise à jour');
    editModalOpen.value = false;
    showToast('Signalement mis à jour', 'success');
    // Notify sidebar to refresh notification count
    window.dispatchEvent(new CustomEvent('notifications:updated'));
    await loadData();
  } catch (err: any) {
    showToast(err.message || 'Erreur', 'danger');
  } finally {
    saving.value = false;
  }
}

function confirmDelete(s: Signalement) {
  signalementToDelete.value = s;
  deleteAlertOpen.value = true;
}

async function deleteSignalement() {
  if (!signalementToDelete.value) return;
  try {
    const token = getAuthToken();
    const response = await fetch(`${getBackendUrl()}/api/signalements/${signalementToDelete.value.id_signalement}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Erreur lors de la suppression');
    showToast('Signalement supprimé', 'success');
    await loadData();
  } catch (err: any) {
    showToast(err.message || 'Erreur', 'danger');
  }
  signalementToDelete.value = null;
}

function goToCarte() {
  router.push({ name: 'Carte' });
}

function showToast(message: string, color: string) {
  toast.value = { show: true, message, color };
}

function truncate(text: string, length: number): string {
  if (!text) return '';
  return text.length > length ? text.substring(0, length) + '...' : text;
}

function formatDate(date: string): string {
  if (!date) return '';
  return new Date(date).toLocaleDateString('fr-FR');
}

function formatBudget(budget: number): string {
  return budget.toLocaleString('fr-FR');
}

function getStatusLabel(id: number | string): string {
  const numId = Number(id);
  switch (numId) {
    case 1: return 'Nouveau';
    case 2: return 'En cours';
    case 3: return 'Terminé';
    default: return 'Inconnu';
  }
}

function getStatusColor(id: number | string): string {
  const numId = Number(id);
  switch (numId) {
    case 1: return 'warning';
    case 2: return 'primary';
    case 3: return 'success';
    default: return 'medium';
  }
}

function getStatusClass(id: number | string): string {
  const numId = Number(id);
  switch (numId) {
    case 1: return 'status-nouveau';
    case 2: return 'status-encours';
    case 3: return 'status-termine';
    default: return '';
  }
}
</script>

<style scoped>
.stats-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin-bottom: 20px;
}

.stat-card {
  background: linear-gradient(135deg, #2d3748 0%, #1a202c 100%);
  border-radius: 14px;
  padding: 16px 12px;
  text-align: center;
  color: white;
  box-shadow: 0 4px 15px rgba(245, 158, 11, 0.3);
  transition: transform 0.2s ease;
}

.stat-card:hover {
  transform: translateY(-2px);
}

.stat-card.stat-nouveau {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  box-shadow: 0 4px 15px rgba(245, 87, 108, 0.3);
}

.stat-card.stat-encours {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
  box-shadow: 0 4px 15px rgba(79, 172, 254, 0.3);
}

.stat-card.stat-termine {
  background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
  box-shadow: 0 4px 15px rgba(67, 233, 123, 0.3);
}

.stat-value {
  font-size: 26px;
  font-weight: 800;
}

.stat-label {
  font-size: 11px;
  opacity: 0.9;
  margin-top: 4px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 300px;
  color: #718096;
}

.loading-container p {
  font-size: 14px;
  margin-top: 12px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 400px;
  text-align: center;
  color: #718096;
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 16px;
  opacity: 0.4;
}

.empty-state h3 {
  color: #4a5568;
  margin-bottom: 8px;
}

.signalements-list {
  background: transparent;
}

.signalement-item {
  --background: #ffffff;
  margin-bottom: 10px;
  border-radius: 14px;
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.06);
  overflow: hidden;
  transition: all 0.2s ease;
}

.signalement-item:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}

.signalement-item.status-nouveau {
  border-left: 4px solid #f5576c;
}

.signalement-item.status-encours {
  border-left: 4px solid #4facfe;
}

.signalement-item.status-termine {
  border-left: 4px solid #43e97b;
}

.location-icon {
  color: var(--ion-color-primary);
  font-size: 24px;
}

.signalement-item h2 {
  font-weight: 600;
  font-size: 15px;
  margin-bottom: 4px;
  color: #1a202c;
}

.meta {
  font-size: 12px;
  color: #718096;
  display: flex;
  gap: 12px;
}

.details {
  margin-top: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.surface, .budget {
  font-size: 12px;
  color: #4a5568;
  background: #f0f4f8;
  padding: 2px 8px;
  border-radius: 6px;
  font-weight: 500;
}

/* ============================
   MODAL FORM STYLING
   ============================ */
.modal-content {
  --background: #f0f2f5;
}

.modal-form {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.modal-form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.modal-label {
  font-size: 12px;
  font-weight: 700;
  color: #4a5568;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding-left: 2px;
}

.modal-input {
  --background: #ffffff !important;
  --color: #2d3748 !important;
  --placeholder-color: #a0aec0 !important;
  --placeholder-opacity: 1 !important;
  --padding-start: 16px;
  --padding-end: 16px;
  border: 2px solid #d1d9e6;
  border-radius: 12px;
  background: #ffffff !important;
  color: #2d3748 !important;
  font-size: 15px;
  transition: border-color 0.2s ease;
}

.modal-input:focus-within {
  border-color: #f59e0b;
  box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.12);
}

.modal-select {
  --background: #ffffff;
  --color: #2d3748;
  --placeholder-color: #a0aec0;
  border: 2px solid #d1d9e6;
  border-radius: 12px;
  padding: 8px 16px;
  font-size: 15px;
  color: #2d3748;
  background: #ffffff;
}

.modal-actions {
  margin-top: 28px;
}

.modal-save-btn {
  --background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  --border-radius: 14px;
  height: 52px;
  font-weight: 700;
  font-size: 15px;
  box-shadow: 0 4px 16px rgba(245, 158, 11, 0.35);
}

ion-fab-button {
  --background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
}

@media (max-width: 600px) {
  .stats-cards {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
