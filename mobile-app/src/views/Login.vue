<template>
  <ion-page>
    <ion-header :translucent="true">
      <ion-toolbar>
        <ion-title>Connexion</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding page-login app-surface">
      <form @submit.prevent="onSubmit">
        <ion-item>
          <ion-label position="stacked">Email</ion-label>
          <ion-input v-model="email" type="email" required autocomplete="email" />
        </ion-item>

        <ion-item>
          <ion-label position="stacked">Mot de passe</ion-label>
          <ion-input v-model="password" type="password" required autocomplete="current-password" />
        </ion-item>

        <div class="actions">
          <ion-button expand="block" type="submit" :disabled="loading">Se connecter</ion-button>
        </div>
      </form>

      <ion-toast :is-open="toast.show" :message="toast.message" :duration="2000" />
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonItem, IonLabel, IonInput, IonButton, IonToast } from '@ionic/vue';
import { login as authLogin } from '../services/auth';

const router = useRouter();
const email = ref('');
const password = ref('');
const loading = ref(false);
const toast = ref({ show: false, message: '' });

async function onSubmit() {
  if (!email.value || !password.value) {
    toast.value = { show: true, message: 'Veuillez remplir tous les champs.' };
    return;
  }

  loading.value = true;
  try {
    await authLogin(email.value, password.value);
    toast.value = { show: true, message: 'Connexion réussie' };
    // rediriger vers la carte après un court délai
    setTimeout(() => router.push('/carte'), 700);
  } catch (err: any) {
    toast.value = { show: true, message: err?.message || 'Erreur de connexion' };
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.page-login {
  display: flex;
  align-items: center;
  justify-content: center;
  padding-top: 28px;
}

.page-login form {
  max-width: 420px;
  width: 100%;
  margin: 24px auto;
  padding: 20px;
  background: var(--ion-background);
  border-radius: var(--ion-radius);
  box-shadow: var(--ion-elevation);
}

ion-item {
  --background: var(--ion-input-background);
  border-radius: calc(var(--ion-radius) - 2px);
  margin-bottom: 12px;
  --inner-padding-end: 12px;
}

ion-label {
  color: var(--ion-muted);
  font-weight: 600;
}

ion-input input {
  color: var(--ion-text-color);
}

ion-item:focus-within {
  box-shadow: var(--ion-focus);
}

ion-button {
  --background: var(--ion-color-primary);
  --color: var(--ion-color-primary-contrast);
  border-radius: 12px;
  box-shadow: 0 10px 24px rgba(37,99,235,0.14);
  transition: transform 0.12s ease, box-shadow 0.12s ease;
}

ion-button:active {
  transform: translateY(1px);
  box-shadow: 0 6px 16px rgba(37,99,235,0.12);
}

ion-button[disabled] {
  opacity: 0.7;
  filter: grayscale(0.12);
}

.actions { margin-top: 20px; }
</style>
