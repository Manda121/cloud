<template>
  <ion-page>
    <ion-header>
      <ion-toolbar color="primary">
        <ion-buttons slot="start">
          <ion-menu-button></ion-menu-button>
        </ion-buttons>
        <ion-title>
          <div class="header-title">
            <ion-icon :icon="notificationsOutline"></ion-icon>
            <span>Notifications</span>
          </div>
        </ion-title>
        <ion-buttons slot="end">
          <ion-button @click="handleMarkAllRead" v-if="notifications.length > 0" title="Tout marquer comme lu">
            <ion-icon :icon="checkmarkDoneOutline"></ion-icon>
          </ion-button>
          <ion-button @click="refreshList" title="Actualiser">
            <ion-icon :icon="refreshOutline"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="notifications-content">
      <!-- Loading -->
      <div v-if="loading" class="loading-container">
        <ion-spinner name="crescent" color="primary"></ion-spinner>
        <p>Chargement des notifications...</p>
      </div>

      <!-- Backend offline (only when no fallback notifications available) -->
      <div v-else-if="!backendOnline && notifications.length === 0" class="empty-state">
        <div class="empty-icon-wrapper">
          <ion-icon :icon="cloudOfflineOutline" class="empty-icon"></ion-icon>
        </div>
        <h3>Notifications indisponibles hors-ligne</h3>
        <p>
          Le serveur n'est pas joignable. Si des notifications existent en mode offline, elles s'afficheront ici.
          Démarrez le backend, puis appuyez sur Actualiser pour obtenir les notifications du serveur.
        </p>
        <p v-if="backendUrl" style="margin-top: 8px;">
          Backend détecté : {{ backendUrl }}
        </p>
      </div>

      <!-- Empty state -->
      <div v-else-if="notifications.length === 0" class="empty-state">
        <div class="empty-icon-wrapper">
          <ion-icon :icon="notificationsOffOutline" class="empty-icon"></ion-icon>
        </div>
        <h3>Aucune notification</h3>
        <p>Vous recevrez une notification lorsqu'un statut de signalement change.</p>
      </div>

      <!-- Notifications list -->
      <div v-else class="notifications-list">
        <div 
          v-for="n in notifications" 
          :key="n.id" 
          class="notification-card"
          :class="{ 'unread': !n.read }"
          @click="handleNotificationClick(n)"
        >
          <div class="notif-icon-wrapper" :class="getNotifTypeClass(n)">
            <ion-icon :icon="getNotifIcon(n)"></ion-icon>
          </div>
          <div class="notif-content">
            <div class="notif-header">
              <h4>{{ n.title }}</h4>
              <span class="notif-time">{{ formatTimeAgo(n.created_at) }}</span>
            </div>
            <p class="notif-message">{{ n.message }}</p>
            <div class="notif-meta" v-if="n.latitude && n.longitude">
              <ion-icon :icon="locationOutline"></ion-icon>
              <span>{{ Number(n.latitude).toFixed(4) }}, {{ Number(n.longitude).toFixed(4) }}</span>
            </div>
          </div>
          <div class="notif-dot" v-if="!n.read"></div>
        </div>
      </div>

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
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons,
  IonButton, IonMenuButton, IonIcon, IonSpinner, IonToast
} from '@ionic/vue';
import {
  notificationsOutline, notificationsOffOutline, refreshOutline,
  checkmarkDoneOutline, locationOutline, alertCircleOutline,
  checkmarkCircleOutline, timeOutline, arrowForwardOutline,
  cloudOfflineOutline
} from 'ionicons/icons';
import { getNotifications, markNotificationAsRead, markAllNotificationsAsRead, Notification } from '../services/notification';
import { isBackendReachable, getBackendUrl } from '../services/backend';

const router = useRouter();
const notifications = ref<Notification[]>([]);
const loading = ref(true);
const toast = ref({ show: false, message: '', color: 'success' });
const backendOnline = ref(true);
const backendUrl = ref(getBackendUrl());

onMounted(async () => {
  await loadNotifications();
});

async function loadNotifications() {
  loading.value = true;
  try {
    backendUrl.value = getBackendUrl();
    backendOnline.value = await isBackendReachable();
    console.log('[Notifications] Loading notifications... (backendOnline=', backendOnline.value, ')');
    const data = await getNotifications();
    console.log('[Notifications] Received:', JSON.stringify(data));
    notifications.value = data;
  } catch (err: any) {
    console.error('[Notifications] Erreur chargement:', err.message, err);
    toast.value = { show: true, message: 'Erreur: ' + (err.message || 'Chargement échoué'), color: 'danger' };
  } finally {
    loading.value = false;
  }
}

async function refreshList() {
  await loadNotifications();
  toast.value = {
    show: true,
    message: backendOnline.value ? 'Notifications actualisées' : 'Backend indisponible',
    color: backendOnline.value ? 'success' : 'warning'
  };
}

async function handleNotificationClick(n: Notification) {
  if (!backendOnline.value) {
    toast.value = { show: true, message: 'Backend indisponible', color: 'warning' };
    return;
  }
  if (!n.read) {
    try {
      await markNotificationAsRead(n.id);
      n.read = true;
    } catch (err) {
      console.error('Erreur marquage notification:', err);
    }
  }
  // Navigate to signalement details
  if (n.id_signalement) {
    router.push({ name: 'Signalement', query: { id: n.id_signalement } });
  }
}

async function handleMarkAllRead() {
  try {
    if (!backendOnline.value) {
      toast.value = { show: true, message: 'Backend indisponible', color: 'warning' };
      return;
    }
    await markAllNotificationsAsRead();
    notifications.value.forEach(n => n.read = true);
    toast.value = { show: true, message: 'Toutes les notifications marquées comme lues', color: 'success' };
    window.dispatchEvent(new CustomEvent('notifications:updated'));
  } catch (err) {
    toast.value = { show: true, message: 'Erreur', color: 'danger' };
  }
}

function getNotifTypeClass(n: Notification) {
  if (n.title?.includes('En cours')) return 'notif-encours';
  if (n.title?.includes('Terminé')) return 'notif-termine';
  return 'notif-default';
}

function getNotifIcon(n: Notification) {
  if (n.title?.includes('Terminé')) return checkmarkCircleOutline;
  if (n.title?.includes('En cours')) return timeOutline;
  return alertCircleOutline;
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'À l\'instant';
  if (diffMin < 60) return `Il y a ${diffMin} min`;
  if (diffHrs < 24) return `Il y a ${diffHrs}h`;
  if (diffDays < 7) return `Il y a ${diffDays}j`;
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}
</script>

<style scoped>
.notifications-content {
  --background: #f0f2f5;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-title ion-icon {
  font-size: 22px;
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
  margin-top: 12px;
  font-size: 14px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 400px;
  text-align: center;
  padding: 24px;
}

.empty-icon-wrapper {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: linear-gradient(135deg, #e2e8f0 0%, #cbd5e0 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;
}

.empty-icon {
  font-size: 40px;
  color: #a0aec0;
}

.empty-state h3 {
  margin: 0 0 8px;
  color: #4a5568;
  font-size: 18px;
}

.empty-state p {
  margin: 0;
  color: #a0aec0;
  font-size: 14px;
  max-width: 280px;
}

.notifications-list {
  padding: 12px;
}

.notification-card {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 16px;
  margin-bottom: 8px;
  background: white;
  border-radius: 14px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
}

.notification-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transform: translateY(-1px);
}

.notification-card.unread {
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.04) 0%, rgba(217, 119, 6, 0.04) 100%);
  border-left: 3px solid #f59e0b;
}

.notif-icon-wrapper {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.notif-icon-wrapper ion-icon {
  font-size: 22px;
  color: white;
}

.notif-default {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
}

.notif-encours {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
}

.notif-termine {
  background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
}

.notif-content {
  flex: 1;
  min-width: 0;
}

.notif-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 4px;
}

.notif-header h4 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #2d3748;
}

.notif-time {
  font-size: 11px;
  color: #a0aec0;
  white-space: nowrap;
  flex-shrink: 0;
}

.notif-message {
  margin: 0 0 8px;
  font-size: 13px;
  color: #718096;
  line-height: 1.4;
}

.notif-meta {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: #a0aec0;
}

.notif-meta ion-icon {
  font-size: 14px;
}

.notif-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #f59e0b;
  flex-shrink: 0;
  margin-top: 4px;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(0.9); }
}
</style>
