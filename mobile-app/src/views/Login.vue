<template>
  <ion-page>
    <ion-header>
      <ion-toolbar color="primary">
        <ion-buttons slot="start">
          <ion-menu-button></ion-menu-button>
        </ion-buttons>
        <ion-title>
          <div class="header-title">
            <ion-icon :icon="logInOutline"></ion-icon>
            <span>Connexion</span>
          </div>
        </ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <div class="login-container">
        <!-- Logo / Header -->
        <div class="login-header">
          <div class="logo-circle">
            <ion-icon :icon="mapOutline"></ion-icon>
          </div>
          <h1>Signalement Routes</h1>
          <p>Connectez-vous pour signaler les dégradations</p>
        </div>

        <!-- Login Form -->
        <div class="login-card">
          <form @submit.prevent="onSubmit">
            <div class="form-group">
              <label class="form-label">
                <ion-icon :icon="mailOutline"></ion-icon>
                Adresse email
              </label>
              <div class="input-wrapper">
                <ion-input 
                  v-model="email" 
                  type="email" 
                  required 
                  autocomplete="email"
                  placeholder="votre@email.com"
                  class="custom-input"
                />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">
                <ion-icon :icon="lockClosedOutline"></ion-icon>
                Mot de passe
              </label>
              <div class="input-wrapper">
                <ion-input 
                  v-model="password" 
                  :type="showPassword ? 'text' : 'password'" 
                  required 
                  autocomplete="current-password"
                  placeholder="••••••••"
                  class="custom-input"
                />
                <ion-button fill="clear" class="toggle-password" @click="showPassword = !showPassword">
                  <ion-icon :icon="showPassword ? eyeOffOutline : eyeOutline"></ion-icon>
                </ion-button>
              </div>
            </div>

            <div v-if="errorMsg" class="alert alert-error">
              <ion-icon :icon="alertCircleOutline"></ion-icon>
              {{ errorMsg }}
            </div>

            <ion-button expand="block" type="submit" :disabled="loading" class="submit-btn">
              <ion-spinner v-if="loading" name="crescent"></ion-spinner>
              <template v-else>
                <ion-icon :icon="logInOutline" slot="start"></ion-icon>
                Se connecter
              </template>
            </ion-button>
          </form>

          <div class="divider">
            <span>ou</span>
          </div>

          <ion-button expand="block" fill="outline" @click="goToRegister" class="register-btn">
            <ion-icon :icon="personAddOutline" slot="start"></ion-icon>
            Créer un compte
          </ion-button>
        </div>

        <!-- Footer -->
        <div class="login-footer">
          <p>En vous connectant, vous acceptez nos conditions d'utilisation</p>
        </div>
      </div>

      <ion-toast :is-open="toast.show" :message="toast.message" :duration="2000" @didDismiss="toast.show = false" />
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { 
  IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonInput, 
  IonButton, IonToast, IonButtons, IonMenuButton, IonIcon, IonSpinner
} from '@ionic/vue';
import { 
  logInOutline, mapOutline, mailOutline, lockClosedOutline, 
  eyeOutline, eyeOffOutline, alertCircleOutline, personAddOutline
} from 'ionicons/icons';
import { login as authLogin } from '../services/auth';

const router = useRouter();
const email = ref('');
const password = ref('');
const loading = ref(false);
const showPassword = ref(false);
const errorMsg = ref<string | null>(null);
const toast = ref({ show: false, message: '' });

async function onSubmit() {
  errorMsg.value = null;
  
  if (!email.value || !password.value) {
    errorMsg.value = 'Veuillez remplir tous les champs';
    return;
  }

  loading.value = true;
  try {
    await authLogin(email.value, password.value);
    toast.value = { show: true, message: 'Connexion réussie !' };
    setTimeout(() => router.push('/carte'), 700);
  } catch (err: any) {
    errorMsg.value = err?.message || 'Erreur de connexion';
  } finally {
    loading.value = false;
  }
}

function goToRegister() {
  router.push('/register');
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

.login-container {
  min-height: 100%;
  display: flex;
  flex-direction: column;
  padding: 24px;
  background: linear-gradient(180deg, #f0f2f5 0%, #e2e8f0 100%);
}

.login-header {
  text-align: center;
  padding: 40px 0;
}

.logo-circle {
  width: 80px;
  height: 80px;
  margin: 0 auto 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 10px 30px rgba(102, 126, 234, 0.4);
}

.logo-circle ion-icon {
  font-size: 40px;
  color: white;
}

.login-header h1 {
  margin: 0 0 8px;
  font-size: 24px;
  font-weight: 700;
  color: #1a202c;
}

.login-header p {
  margin: 0;
  font-size: 14px;
  color: #718096;
}

.login-card {
  background: white;
  border-radius: 20px;
  padding: 32px 24px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
}

.form-group {
  margin-bottom: 20px;
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

.input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.custom-input {
  --background: #ffffff;
  --color: #2d3748 !important;
  --placeholder-color: #a0aec0 !important;
  --placeholder-opacity: 1 !important;
  --padding-start: 16px;
  --padding-end: 50px;
  border: 2px solid #d1d9e6;
  border-radius: 12px;
  height: 50px;
  width: 100%;
  background: #ffffff;
  color: #2d3748 !important;
}

.custom-input:focus-within {
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.12);
}

.toggle-password {
  position: absolute;
  right: 4px;
  --color: #718096;
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

.submit-btn {
  --background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  --border-radius: 12px;
  height: 50px;
  font-weight: 600;
  margin-top: 8px;
}

.divider {
  display: flex;
  align-items: center;
  margin: 24px 0;
}

.divider::before,
.divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: #e2e8f0;
}

.divider span {
  padding: 0 16px;
  color: #a0aec0;
  font-size: 14px;
}

.register-btn {
  --border-radius: 12px;
  --border-color: #667eea;
  --color: #667eea;
  height: 50px;
  font-weight: 600;
}

.login-footer {
  text-align: center;
  padding: 24px 0;
}

.login-footer p {
  margin: 0;
  font-size: 12px;
  color: #a0aec0;
}
</style>
