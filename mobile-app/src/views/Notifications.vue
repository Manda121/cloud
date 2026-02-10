<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/"></ion-back-button>
        </ion-buttons>
        <ion-title>Notifications</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="markAllRead" :disabled="unreadCount === 0">
            <ion-icon :icon="checkmarkDoneOutline"></ion-icon>
          </ion-button>
          <ion-button @click="refreshNotifications">
            <ion-icon :icon="refreshOutline"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <!-- Badge notifications non lues -->
      <div v-if="unreadCount > 0" class="unread-banner">
        <ion-icon :icon="notificationsOutline"></ion-icon>
        <span>{{ unreadCount }} notification(s) non lue(s)</span>
      </div>

      <!-- Loading state -->
      <div v-if="loading" class="loading-container">
        <ion-spinner name="crescent"></ion-spinner>
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
        <ion-icon :icon="notificationsOffOutline" class="empty-icon"></ion-icon>
        <h3>Aucune notification</h3>
        <p>Vous recevrez des notifications lorsque le statut de vos signalements changera.</p>
      </div>

      <!-- Liste des notifications -->
      <ion-list v-else>
        <ion-item-sliding v-for="notif in notifications" :key="notif.id">
          <ion-item 
            :class="{ 'unread': !notif.read }"
            @click="openNotification(notif)"
            button
          >
            <ion-icon 
              :icon="getNotificationIcon(notif.type)" 
              slot="start"
              :color="notif.read ? 'medium' : 'primary'"
            ></ion-icon>
            
            <ion-label>
              <h2>{{ notif.title }}</h2>
              <p>{{ notif.message }}</p>
              <p class="notification-time">
                <ion-icon :icon="timeOutline"></ion-icon>
                {{ formatDate(notif.created_at) }}
              </p>
            </ion-label>

            <ion-badge v-if="!notif.read" color="primary" slot="end">
              Nouveau
            </ion-badge>
          </ion-item>

          <ion-item-options side="end">
            <ion-item-option color="primary" @click="markAsRead(notif)">
              <ion-icon :icon="checkmarkOutline"></ion-icon>
              Lu
            </ion-item-option>
            <ion-item-option color="secondary" @click="viewSignalement(notif)">
              <ion-icon :icon="eyeOutline"></ion-icon>
              Voir
            </ion-item-option>
          </ion-item-options>
        </ion-item-sliding>
      </ion-list>

      <!-- Infinite scroll -->
      <ion-infinite-scroll @ionInfinite="loadMore" :disabled="!hasMore">
        <ion-infinite-scroll-content
          loading-spinner="bubbles"
          loading-text="Chargement..."
        ></ion-infinite-scroll-content>
      </ion-infinite-scroll>

      <!-- Toast pour les nouvelles notifications -->
      <ion-toast
        :is-open="showToast"
        :message="toastMessage"
        :duration="3000"
        position="top"
        color="primary"
        @didDismiss="showToast = false"
      ></ion-toast>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonList,
  IonItem,
  IonItemSliding,
  IonItemOptions,
  IonItemOption,
  IonLabel,
  IonIcon,
  IonBadge,
  IonButtons,
  IonButton,
  IonBackButton,
  IonSpinner,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonToast,
} from '@ionic/vue';
import {
  notificationsOutline, notificationsOffOutline, refreshOutline,
  checkmarkDoneOutline, locationOutline, alertCircleOutline,
  checkmarkCircleOutline, timeOutline, arrowForwardOutline,
  cloudOfflineOutline
} from 'ionicons/icons';
import { getNotifications, markNotificationAsRead, markAllNotificationsAsRead, Notification } from '../services/notification';
import { isBackendReachable, getBackendUrl } from '../services/backend';

import {
  getNotifications,
  getUnreadCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  addNotificationListener,
  type Notification,
} from '../services/notifications';

const router = useRouter();

// State
const notifications = ref<Notification[]>([]);
const unreadCount = ref(0);
const loading = ref(true);
const toast = ref({ show: false, message: '', color: 'success' });
const backendOnline = ref(true);
const backendUrl = ref(getBackendUrl());

// Toast
const showToast = ref(false);
const toastMessage = ref('');

// Cleanup function for notification listener
let unsubscribe: (() => void) | null = null;

// ============================================
// LIFECYCLE
// ============================================

onMounted(async () => {
  await refreshNotifications();
  
  // Écouter les nouvelles notifications
  unsubscribe = addNotificationListener((notif) => {
    toastMessage.value = notif.title;
    showToast.value = true;
    
    // Rafraîchir la liste
    refreshNotifications();
  });
});

onUnmounted(() => {
  if (unsubscribe) {
    unsubscribe();
  }
});

// ============================================
// METHODS
// ============================================

async function refreshNotifications() {
  loading.value = true;
  offset.value = 0;
  
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
}

async function markAllRead() {
  try {
    if (!backendOnline.value) {
      toast.value = { show: true, message: 'Backend indisponible', color: 'warning' };
      return;
    }
    await markAllNotificationsAsRead();
    notifications.value.forEach(n => n.read = true);
    unreadCount.value = 0;
  } catch (error) {
    console.error('Error marking all as read:', error);
  }
}

function openNotification(notif: Notification) {
  markAsRead(notif);
  
  // Naviguer vers le signalement si disponible
  if (notif.id_signalement) {
    router.push(`/signalement/${notif.id_signalement}`);
  }
}

function viewSignalement(notif: Notification) {
  if (notif.id_signalement) {
    router.push(`/signalement/${notif.id_signalement}`);
  }
}

function getNotificationIcon(type: string): string {
  switch (type) {
    case 'STATUS_CHANGE':
      return syncOutline;
    case 'STATUS_COMPLETED':
      return checkmarkCircleOutline;
    case 'STATUS_IN_PROGRESS':
      return hourglassOutline;
    case 'ALERT':
      return alertCircleOutline;
    default:
      return notificationsOutline;
  }
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "À l'instant";
  if (diffMins < 60) return `Il y a ${diffMins} min`;
  if (diffHours < 24) return `Il y a ${diffHours}h`;
  if (diffDays < 7) return `Il y a ${diffDays}j`;
  
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}
</script>

<style scoped>
.unread-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: var(--ion-color-primary);
  color: white;
  font-weight: 500;
}

.unread-banner ion-icon {
  font-size: 20px;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: var(--ion-color-medium);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  text-align: center;
  color: var(--ion-color-medium);
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.empty-state h3 {
  margin: 0 0 8px;
  color: var(--ion-color-dark);
}

.empty-state p {
  margin: 0;
  max-width: 280px;
}

ion-item.unread {
  --background: rgba(var(--ion-color-primary-rgb), 0.05);
}

ion-item.unread ion-label h2 {
  font-weight: 600;
}

.notification-time {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--ion-color-medium);
  margin-top: 4px;
}

.notification-time ion-icon {
  font-size: 12px;
}

ion-item-option ion-icon {
  font-size: 20px;
}
</style>
