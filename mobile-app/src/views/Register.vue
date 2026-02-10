<template>
  <ion-page>
    <ion-header>
      <ion-toolbar color="primary">
        <ion-buttons slot="start">
          <ion-back-button default-href="/login"></ion-back-button>
        </ion-buttons>
        <ion-title>
          <div class="header-title">
            <ion-icon :icon="personAddOutline"></ion-icon>
            <span>Inscription</span>
          </div>
        </ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <div class="register-container">
        <div class="register-header">
          <h1>Créer un compte</h1>
          <p>Inscris-toi pour commencer à signaler</p>
        </div>

        <div class="register-card">
          <form @submit.prevent="onSubmit">
            <div class="form-group">
              <label class="form-label">
                <ion-icon :icon="mailOutline"></ion-icon>
                Adresse email
              </label>
              <div class="input-wrapper">
                <ion-input v-model="email" type="email" required placeholder="votre@email.com" class="custom-input" />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">
                <ion-icon :icon="personOutline"></ion-icon>
                Prénom
              </label>
              <div class="input-wrapper">
                <ion-input v-model="firstname" type="text" placeholder="Prénom" class="custom-input" />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">
                <ion-icon :icon="personOutline"></ion-icon>
                Nom
              </label>
              <div class="input-wrapper">
                <ion-input v-model="lastname" type="text" placeholder="Nom" class="custom-input" />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">
                <ion-icon :icon="lockClosedOutline"></ion-icon>
                Mot de passe
              </label>
              <div class="input-wrapper">
                <ion-input v-model="password" :type="showPassword ? 'text' : 'password'" required placeholder="••••••••" class="custom-input" />
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
                <ion-icon :icon="personAddOutline" slot="start"></ion-icon>
                Créer un compte
              </template>
            </ion-button>
          </form>
        </div>

        <div class="register-footer">
          <p>En créant un compte, vous acceptez nos conditions d'utilisation</p>
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
  IonButton, IonToast, IonButtons, IonBackButton, IonIcon, IonSpinner
} from '@ionic/vue';
import { 
  mailOutline, lockClosedOutline, personAddOutline, eyeOutline, eyeOffOutline, alertCircleOutline, personOutline
} from 'ionicons/icons';
import { register as apiRegister } from '../services/auth';

const router = useRouter();
const email = ref('');
const password = ref('');
const firstname = ref('');
const lastname = ref('');
const loading = ref(false);
const showPassword = ref(false);
const errorMsg = ref<string | null>(null);
const toast = ref({ show: false, message: '' });

async function onSubmit() {
  errorMsg.value = null;
  if (!email.value || !password.value) {
    errorMsg.value = 'Veuillez remplir au minimum l\'email et le mot de passe';
    return;
  }

  loading.value = true;
  try {
    await apiRegister(email.value, password.value, firstname.value, lastname.value);
    toast.value = { show: true, message: 'Compte créé !' };
    setTimeout(() => {
      const token = localStorage.getItem('auth_token');
      if (token) router.push('/carte');
      else router.push('/login');
    }, 700);
  } catch (err: any) {
    errorMsg.value = err?.message || 'Erreur d\'inscription';
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.header-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.register-container {
  min-height: 100%;
  display: flex;
  flex-direction: column;
  padding: 24px;
  background: linear-gradient(180deg, #f0f2f5 0%, #e2e8f0 100%);
}

.register-header {
  text-align: center;
  padding: 40px 0;
}

.register-header h1 {
  margin: 0 0 8px;
  font-size: 24px;
  font-weight: 700;
  color: #1a202c;
}

.register-header p {
  margin: 0;
  font-size: 14px;
  color: #718096;
}

.register-card {
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

.alert-error {
  margin-top: 10px;
  padding: 12px;
  background: #fff5f5;
  border: 1px solid #feb2b2;
  border-radius: 8px;
  color: #c53030;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

.submit-btn {
  margin-top: 16px;
  --background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  --border-radius: 12px;
  height: 50px;
  font-weight: 600;
}

.register-footer {
  text-align: center;
  padding: 24px;
}

.register-footer p {
  margin: 0;
  font-size: 12px;
  color: #a0aec0;
}
</style>
