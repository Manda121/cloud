<template>
  <ion-app>
    <ion-split-pane content-id="main-content">
      <!-- Sidebar Menu -->
      <ion-menu content-id="main-content" type="overlay">
        <ion-header>
          <ion-toolbar color="primary">
            <ion-title>
              <div class="menu-header">
                <ion-icon :icon="constructOutline" class="menu-logo"></ion-icon>
                <span>RoadWatch</span>
              </div>
            </ion-title>
          </ion-toolbar>
        </ion-header>
        <ion-content>
          <!-- User info -->
          <div class="user-card" v-if="currentUser">
            <ion-avatar>
              <div class="avatar-placeholder">{{ getInitials(currentUser.email) }}</div>
            </ion-avatar>
            <div class="user-info">
              <p class="user-email">{{ currentUser.email }}</p>
              <p class="user-status">
                <span class="status-dot"></span>
                Connecté
              </p>
            </div>
          </div>

          <div class="menu-section-label" v-if="isLoggedIn">NAVIGATION</div>

          <ion-list lines="none" class="menu-list">
            <ion-menu-toggle :auto-hide="false">
              <ion-item router-link="/carte" router-direction="root" class="menu-item">
                <ion-icon :icon="mapOutline" slot="start"></ion-icon>
                <ion-label>Carte</ion-label>
              </ion-item>
            </ion-menu-toggle>

            <ion-menu-toggle :auto-hide="false">
              <ion-item router-link="/signalements" router-direction="root" class="menu-item">
                <ion-icon :icon="listOutline" slot="start"></ion-icon>
                <ion-label>Signalements</ion-label>
                <ion-badge color="primary" slot="end" v-if="signalementCount > 0">{{ signalementCount }}</ion-badge>
              </ion-item>
            </ion-menu-toggle>

            <ion-menu-toggle :auto-hide="false" v-if="isLoggedIn">
              <ion-item router-link="/notifications" router-direction="root" class="menu-item">
                <ion-icon :icon="notificationsOutline" slot="start"></ion-icon>
                <ion-label>Notifications</ion-label>
                <ion-badge color="danger" slot="end" v-if="unreadNotifCount > 0">{{ unreadNotifCount }}</ion-badge>
              </ion-item>
            </ion-menu-toggle>

            <ion-menu-toggle :auto-hide="false" v-if="isLoggedIn">
              <ion-item @click="handleSync" class="menu-item" :disabled="syncing">
                <ion-icon :icon="syncOutline" slot="start"></ion-icon>
                <ion-label>{{ syncing ? 'Synchronisation...' : 'Synchroniser' }}</ion-label>
                <ion-badge color="warning" slot="end" v-if="unsyncedCount > 0">{{ unsyncedCount }}</ion-badge>
                <ion-spinner v-if="syncing" name="crescent" slot="end" style="width:20px;height:20px"></ion-spinner>
              </ion-item>
            </ion-menu-toggle>
          </ion-list>

          <div v-if="syncMessage" class="sync-message" :class="syncMessageType">
            <ion-icon :icon="syncMessageType === 'success' ? checkmarkCircleOutline : alertCircleOutline"></ion-icon>
            {{ syncMessage }}
          </div>

          <div class="menu-divider"></div>
          <div class="menu-section-label">COMPTE</div>

          <ion-list lines="none" class="menu-list">
            <ion-menu-toggle :auto-hide="false" v-if="!isLoggedIn">
              <ion-item router-link="/login" router-direction="root" class="menu-item">
                <ion-icon :icon="logInOutline" slot="start"></ion-icon>
                <ion-label>Connexion</ion-label>
              </ion-item>
            </ion-menu-toggle>

            <ion-menu-toggle :auto-hide="false" v-if="isLoggedIn">
              <ion-item @click="handleLogout" class="menu-item menu-item-danger">
                <ion-icon :icon="logOutOutline" slot="start"></ion-icon>
                <ion-label>Déconnexion</ion-label>
              </ion-item>
            </ion-menu-toggle>
          </ion-list>

          <div class="menu-footer">
            <div class="footer-brand">
              <ion-icon :icon="constructOutline"></ion-icon>
              <span>RoadWatch v1.0</span>
            </div>
            <p class="copyright">© 2026 Madagascar</p>
          </div>
        </ion-content>
      </ion-menu>

      <!-- Main Content -->
      <ion-router-outlet id="main-content"></ion-router-outlet>
    </ion-split-pane>
  </ion-app>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import {
  IonApp, IonRouterOutlet, IonSplitPane, IonMenu, IonHeader, IonToolbar,
  IonTitle, IonContent, IonList, IonItem, IonIcon, IonLabel, IonMenuToggle,
  IonBadge, IonAvatar, IonSpinner
} from '@ionic/vue';
import {
  mapOutline, listOutline, logInOutline, logOutOutline, constructOutline,
  notificationsOutline, syncOutline, checkmarkCircleOutline, alertCircleOutline
} from 'ionicons/icons';
import { isAuthenticated, getCurrentUser, logout, AuthUser, ensureAuthenticated, isAnonymousUser } from './services/auth';
import { getSignalements } from './services/signalement';
import { getUnreadCount } from './services/notification';
import { fullSync, getUnsyncedCount } from './services/sync';

const router = useRouter();
const isLoggedIn = ref(false);
const currentUser = ref<AuthUser | null>(null);
const signalementCount = ref(0);
const unreadNotifCount = ref(0);
const unsyncedCount = ref(0);
const syncing = ref(false);
const syncMessage = ref('');
const syncMessageType = ref<'success' | 'error'>('success');

onMounted(async () => {
  // Auto-auth anonyme si personne n'est connecté
  try {
    await ensureAuthenticated();
  } catch (err) {
    console.warn('[App] Auto-auth failed (offline?):', err);
  }
  checkAuth();
  loadSignalementCount();
  loadUnreadNotifCount();
  loadUnsyncedCount();
});

// Watch for route changes to update auth state
watch(() => router.currentRoute.value, () => {
  checkAuth();
  loadSignalementCount();
  loadUnreadNotifCount();
});

// Listen for notification updates
window.addEventListener('notifications:updated', () => {
  loadUnreadNotifCount();
});

function checkAuth() {
  isLoggedIn.value = isAuthenticated();
  currentUser.value = getCurrentUser();
}

async function loadSignalementCount() {
  if (!isAuthenticated()) return;
  try {
    const list = await getSignalements();
    signalementCount.value = list.length;
  } catch {
    signalementCount.value = 0;
  }
}

async function loadUnreadNotifCount() {
  if (!isAuthenticated()) {
    unreadNotifCount.value = 0;
    return;
  }
  try {
    unreadNotifCount.value = await getUnreadCount();
  } catch {
    unreadNotifCount.value = 0;
  }
}

async function loadUnsyncedCount() {
  if (!isAuthenticated()) {
    unsyncedCount.value = 0;
    return;
  }
  try {
    unsyncedCount.value = await getUnsyncedCount();
  } catch {
    unsyncedCount.value = 0;
  }
}

async function handleSync() {
  syncing.value = true;
  syncMessage.value = '';
  try {
    const result = await fullSync();
    const totalSynced = (result.firestoreToBackend?.synced ?? 0) + result.localToFirestore;
    if (totalSynced > 0) {
      syncMessage.value = `${totalSynced} signalement(s) synchronisé(s) !`;
      syncMessageType.value = 'success';
    } else {
      syncMessage.value = 'Tout est déjà à jour';
      syncMessageType.value = 'success';
    }
    await loadUnsyncedCount();
    await loadSignalementCount();
  } catch (err: any) {
    syncMessage.value = err.message || 'Erreur de synchronisation';
    syncMessageType.value = 'error';
  } finally {
    syncing.value = false;
    setTimeout(() => { syncMessage.value = ''; }, 5000);
  }
}

function handleLogout() {
  logout().catch(() => {}); // async logout (Firebase + local)
  isLoggedIn.value = false;
  currentUser.value = null;
  unreadNotifCount.value = 0;
  unsyncedCount.value = 0;
  router.push('/login');
}

function getInitials(email: string): string {
  return email?.charAt(0).toUpperCase() || 'U';
}
</script>

<style>
/* ============================
   GLOBAL DESIGN SYSTEM
   ============================ */
:root {
  --ion-color-primary: #667eea;
  --ion-color-primary-rgb: 102, 126, 234;
  --ion-color-primary-contrast: #ffffff;
  --ion-color-primary-shade: #5a6fd3;
  --ion-color-primary-tint: #7a8eec;

  --ion-color-secondary: #764ba2;
  --ion-color-secondary-rgb: 118, 75, 162;
  --ion-color-secondary-contrast: #ffffff;

  --ion-background-color: #f0f2f5;
  --ion-card-background: #ffffff;
  --ion-toolbar-background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  --ion-toolbar-color: #ffffff;
  
  --app-sidebar-bg: #0f1629;
  --app-sidebar-hover: rgba(102, 126, 234, 0.12);
  --app-sidebar-active: rgba(102, 126, 234, 0.2);
  --app-text-primary: #1a202c;
  --app-text-secondary: #718096;
  --app-text-muted: #a0aec0;
  --app-border: #e2e8f0;
  --app-input-bg: #ffffff;
  --app-input-border: #d1d9e6;
  --app-input-text: #2d3748;
  --app-input-placeholder: #a0aec0;
}

/* ============================
   TOOLBAR
   ============================ */
ion-toolbar {
  --background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  --color: white;
}

/* ============================
   SIDEBAR MENU - MODERN DARK
   ============================ */
ion-menu {
  --background: var(--app-sidebar-bg);
  --ion-background-color: var(--app-sidebar-bg);
  --width: 300px;
}

ion-menu ion-content {
  --background: var(--app-sidebar-bg);
}

ion-menu ion-toolbar {
  --background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  --min-height: 60px;
}

.menu-header {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 700;
  letter-spacing: 0.5px;
}

.menu-logo {
  font-size: 26px;
  filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));
}

/* User Card */
.user-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 20px 20px 16px;
  margin: 16px 14px 8px;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.15) 0%, rgba(118, 75, 162, 0.15) 100%);
  border-radius: 16px;
  border: 1px solid rgba(102, 126, 234, 0.1);
}

.avatar-placeholder {
  width: 46px;
  height: 46px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 18px;
  font-weight: 700;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.user-info {
  flex: 1;
  min-width: 0;
}

.user-email {
  color: #e2e8f0;
  font-weight: 600;
  font-size: 13px;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-status {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #48bb78;
  font-size: 11px;
  margin: 4px 0 0;
  font-weight: 500;
}

.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #48bb78;
  box-shadow: 0 0 6px rgba(72, 187, 120, 0.6);
  animation: statusPulse 2s ease-in-out infinite;
}

@keyframes statusPulse {
  0%, 100% { box-shadow: 0 0 6px rgba(72, 187, 120, 0.6); }
  50% { box-shadow: 0 0 12px rgba(72, 187, 120, 0.9); }
}

/* Section Labels */
.menu-section-label {
  padding: 16px 22px 6px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 1.5px;
  color: #4a5568;
  text-transform: uppercase;
}

.menu-divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.06);
  margin: 8px 20px;
}

/* Menu Items */
.menu-list {
  background: transparent;
  padding: 4px 10px;
}

.menu-item {
  --background: transparent;
  --color: #94a3b8;
  --padding-start: 18px;
  --padding-end: 14px;
  --border-radius: 12px;
  --min-height: 48px;
  margin-bottom: 2px;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  font-size: 14px;
  font-weight: 500;
}

.menu-item:hover {
  --background: var(--app-sidebar-hover);
  --color: #e2e8f0;
}

.menu-item ion-icon {
  color: #667eea;
  font-size: 20px;
  margin-right: 4px;
}

.menu-item.router-link-active {
  --background: var(--app-sidebar-active);
  --color: #fff;
}

.menu-item.router-link-active ion-icon {
  color: #818cf8;
}

.menu-item-danger:hover {
  --background: rgba(245, 87, 108, 0.12);
}

.menu-item-danger ion-icon {
  color: #f5576c !important;
}

/* Menu Footer */
.menu-footer {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 16px 20px;
  text-align: center;
  background: linear-gradient(180deg, transparent 0%, rgba(15, 22, 41, 0.9) 40%);
}

.footer-brand {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: #4a5568;
  font-size: 12px;
  font-weight: 600;
}

.footer-brand ion-icon {
  font-size: 14px;
  color: #667eea;
}

.menu-footer .copyright {
  margin-top: 4px;
  font-size: 10px;
  color: #2d3748;
}

/* ============================
   GLOBAL INPUT OVERRIDES - FIX WHITE TEXT ON WHITE BG
   ============================ */
ion-input,
ion-textarea {
  --color: var(--app-input-text) !important;
  --placeholder-color: var(--app-input-placeholder) !important;
  --placeholder-opacity: 1 !important;
  color: var(--app-input-text) !important;
}

ion-input .native-input,
ion-input input,
ion-textarea textarea,
ion-textarea .native-textarea {
  color: var(--app-input-text) !important;
  caret-color: #667eea !important;
}

ion-input .native-input::placeholder,
ion-textarea textarea::placeholder,
ion-textarea .native-textarea::placeholder {
  color: var(--app-input-placeholder) !important;
  opacity: 1 !important;
}

/* Custom input styling for forms */
.custom-input,
.custom-textarea {
  --background: var(--app-input-bg) !important;
  --color: var(--app-input-text) !important;
  --placeholder-color: var(--app-input-placeholder) !important;
  --border-radius: 12px;
  --padding-start: 16px;
  --padding-end: 16px;
  border: 2px solid var(--app-input-border) !important;
  border-radius: 12px;
  background: var(--app-input-bg) !important;
  color: var(--app-input-text) !important;
  transition: border-color 0.2s ease;
}

.custom-input:focus-within,
.custom-textarea:focus-within {
  border-color: #667eea !important;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

/* Modal inputs */
ion-modal ion-input,
ion-modal ion-textarea,
ion-modal ion-select {
  --color: var(--app-input-text) !important;
  --placeholder-color: var(--app-input-placeholder) !important;
  color: var(--app-input-text) !important;
}

ion-modal ion-item {
  --background: #f8fafc;
  --border-radius: 12px;
  --border-color: var(--app-input-border);
  margin-bottom: 12px;
}

ion-modal ion-label {
  color: var(--app-text-primary) !important;
  font-weight: 600 !important;
}

/* Select styling */
ion-select {
  --color: var(--app-input-text) !important;
  --placeholder-color: var(--app-input-placeholder) !important;
  color: var(--app-input-text) !important;
}

/* Datetime styling */
ion-datetime {
  --background: #ffffff;
  --background-rgb: 255, 255, 255;
  color: var(--app-input-text);
  border-radius: 12px;
}

/* ============================
   CARD & BUTTON STYLING
   ============================ */
ion-card {
  border-radius: 16px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}

ion-button {
  --border-radius: 12px;
  font-weight: 600;
}

ion-item {
  --border-radius: 12px;
}

/* ============================
   BADGE STYLING
   ============================ */
ion-badge {
  --border-radius: 10px;
  font-size: 11px;
  font-weight: 700;
  padding: 3px 8px;
  min-width: 22px;
  text-align: center;
}

/* ============================
   PAGE TRANSITIONS
   ============================ */
ion-router-outlet {
  background: var(--ion-background-color);
}

/* ============================
   SCROLLBAR STYLING
   ============================ */
::-webkit-scrollbar {
  width: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: rgba(102, 126, 234, 0.2);
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(102, 126, 234, 0.4);
}

/* ============================
   SYNC MESSAGE STYLING
   ============================ */
.sync-message {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 8px 16px;
  padding: 10px 14px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 500;
  animation: fadeIn 0.3s ease;
}

.sync-message.success {
  background: #f0fff4;
  color: #22543d;
  border: 1px solid #c6f6d5;
}

.sync-message.error {
  background: #fff5f5;
  color: #c53030;
  border: 1px solid #feb2b2;
}

.sync-message ion-icon {
  font-size: 18px;
  flex-shrink: 0;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-5px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>

