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
        <ion-content class="ion-padding" v-if="editingSignalement">
          <ion-item>
            <ion-label position="stacked">Description</ion-label>
            <ion-textarea v-model="editingSignalement.description" :rows="4"></ion-textarea>
          </ion-item>
          <ion-item>
            <ion-label position="stacked">Surface (m²)</ion-label>
            <ion-input type="number" v-model.number="editingSignalement.surface_m2"></ion-input>
          </ion-item>
          <ion-item>
            <ion-label position="stacked">Budget (Ar)</ion-label>
            <ion-input type="number" v-model.number="editingSignalement.budget"></ion-input>
          </ion-item>
          <ion-item>
            <ion-label position="stacked">Statut</ion-label>
            <ion-select v-model="editingSignalement.id_statut">
              <ion-select-option :value="1">Nouveau</ion-select-option>
              <ion-select-option :value="2">En cours</ion-select-option>
              <ion-select-option :value="3">Terminé</ion-select-option>
            </ion-select>
          </ion-item>
          <div class="modal-actions">
            <ion-button expand="block" @click="saveEdit" :disabled="saving">
              {{ saving ? 'Enregistrement...' : 'Enregistrer' }}
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

const API_BASE = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:3000';

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
    const response = await fetch(`${API_BASE}/api/signalements/${editingSignalement.value.id_signalement}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        description: editingSignalement.value.description,
        surface_m2: editingSignalement.value.surface_m2,
        budget: editingSignalement.value.budget,
        id_statut: editingSignalement.value.id_statut
      })
    });
    if (!response.ok) throw new Error('Erreur lors de la mise à jour');
    editModalOpen.value = false;
    showToast('Signalement mis à jour', 'success');
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
    const response = await fetch(`${API_BASE}/api/signalements/${signalementToDelete.value.id_signalement}`, {
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

function getStatusLabel(id: number): string {
  switch (id) {
    case 1: return 'Nouveau';
    case 2: return 'En cours';
    case 3: return 'Terminé';
    default: return 'Inconnu';
  }
}

function getStatusColor(id: number): string {
  switch (id) {
    case 1: return 'warning';
    case 2: return 'primary';
    case 3: return 'success';
    default: return 'medium';
  }
}

function getStatusClass(id: number): string {
  switch (id) {
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
  gap: 12px;
  margin-bottom: 20px;
}

.stat-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  padding: 16px;
  text-align: center;
  color: white;
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
}

.stat-card.stat-nouveau {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
}

.stat-card.stat-encours {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
}

.stat-card.stat-termine {
  background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
}

.stat-label {
  font-size: 12px;
  opacity: 0.9;
  margin-top: 4px;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 300px;
  color: var(--ion-color-medium);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 400px;
  text-align: center;
  color: var(--ion-color-medium);
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.signalements-list {
  background: transparent;
}

.signalement-item {
  --background: var(--ion-card-background, #fff);
  margin-bottom: 12px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  overflow: hidden;
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
}

.meta {
  font-size: 12px;
  color: var(--ion-color-medium);
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
  color: var(--ion-color-medium);
  background: var(--ion-color-light);
  padding: 2px 8px;
  border-radius: 4px;
}

.modal-actions {
  margin-top: 24px;
}

ion-fab-button {
  --background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

@media (max-width: 600px) {
  .stats-cards {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
