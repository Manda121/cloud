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
              <p class="user-status">Connecté</p>
            </div>
          </div>

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

            <ion-menu-toggle :auto-hide="false" v-if="!isLoggedIn">
              <ion-item router-link="/login" router-direction="root" class="menu-item">
                <ion-icon :icon="logInOutline" slot="start"></ion-icon>
                <ion-label>Connexion</ion-label>
              </ion-item>
            </ion-menu-toggle>

            <ion-menu-toggle :auto-hide="false" v-if="isLoggedIn">
              <ion-item @click="handleLogout" class="menu-item">
                <ion-icon :icon="logOutOutline" slot="start"></ion-icon>
                <ion-label>Déconnexion</ion-label>
              </ion-item>
            </ion-menu-toggle>
          </ion-list>

          <div class="menu-footer">
            <p>RoadWatch v1.0</p>
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
  IonBadge, IonAvatar
} from '@ionic/vue';
import {
  mapOutline, listOutline, logInOutline, logOutOutline, constructOutline
} from 'ionicons/icons';
import { isAuthenticated, getCurrentUser, logout, AuthUser } from './services/auth';
import { getSignalements } from './services/signalement';

const router = useRouter();
const isLoggedIn = ref(false);
const currentUser = ref<AuthUser | null>(null);
const signalementCount = ref(0);

onMounted(() => {
  checkAuth();
  loadSignalementCount();
});

// Watch for route changes to update auth state
watch(() => router.currentRoute.value, () => {
  checkAuth();
  loadSignalementCount();
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

function handleLogout() {
  logout();
  isLoggedIn.value = false;
  currentUser.value = null;
  router.push('/login');
}

function getInitials(email: string): string {
  return email?.charAt(0).toUpperCase() || 'U';
}
</script>

<style>
/* Global styles */
:root {
  --ion-color-primary: #667eea;
  --ion-color-primary-rgb: 102, 126, 234;
  --ion-color-primary-contrast: #ffffff;
  --ion-color-primary-shade: #5a6fd3;
  --ion-color-primary-tint: #7a8eec;

  --ion-color-secondary: #764ba2;
  --ion-color-secondary-rgb: 118, 75, 162;
  --ion-color-secondary-contrast: #ffffff;

  --ion-background-color: #f8fafc;
  --ion-card-background: #ffffff;
  --ion-toolbar-background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  --ion-toolbar-color: #ffffff;
}

ion-toolbar {
  --background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  --color: white;
}

ion-menu {
  --background: #1a1a2e;
  --ion-background-color: #1a1a2e;
}

ion-menu ion-content {
  --background: #1a1a2e;
}

ion-menu ion-toolbar {
  --background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.menu-header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.menu-logo {
  font-size: 28px;
}

.user-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px 16px;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.2) 0%, rgba(118, 75, 162, 0.2) 100%);
  margin: 12px;
  border-radius: 12px;
}

.avatar-placeholder {
  width: 48px;
  height: 48px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 20px;
  font-weight: 600;
}

.user-info {
  flex: 1;
}

.user-email {
  color: #fff;
  font-weight: 600;
  font-size: 14px;
  margin: 0;
}

.user-status {
  color: #43e97b;
  font-size: 12px;
  margin: 4px 0 0;
}

.menu-list {
  background: transparent;
  padding: 8px;
}

.menu-item {
  --background: transparent;
  --color: #a0aec0;
  --padding-start: 16px;
  --border-radius: 12px;
  margin-bottom: 4px;
  transition: all 0.2s ease;
}

.menu-item:hover {
  --background: rgba(102, 126, 234, 0.15);
  --color: #fff;
}

.menu-item ion-icon {
  color: #667eea;
  font-size: 22px;
}

.menu-item.router-link-active {
  --background: linear-gradient(135deg, rgba(102, 126, 234, 0.3) 0%, rgba(118, 75, 162, 0.3) 100%);
  --color: #fff;
}

.menu-footer {
  position: absolute;
  bottom: 20px;
  left: 0;
  right: 0;
  text-align: center;
  color: #4a5568;
  font-size: 12px;
}

.menu-footer .copyright {
  margin-top: 4px;
  opacity: 0.7;
}

/* Page transitions */
ion-router-outlet {
  background: var(--ion-background-color);
}

/* Card styling */
ion-card {
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
}

/* Button styling */
ion-button {
  --border-radius: 12px;
  font-weight: 600;
}

/* Input styling */
ion-item {
  --border-radius: 12px;
}

ion-input, ion-textarea {
  --padding-start: 12px;
}
</style>

