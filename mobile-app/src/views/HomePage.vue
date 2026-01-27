<template>
  <ion-page>
    <ion-header :translucent="true">
      <ion-toolbar>
        <ion-title>Blank</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true" class="page-home app-surface">
      <ion-header collapse="condense">
        <ion-toolbar>
          <ion-title size="large">Blank</ion-title>
        </ion-toolbar>
      </ion-header>

      <div id="container">
        <strong>TONGASOA !</strong>
        <ion-button class="cta" expand="block" @click="goToLogin">Se connecter</ion-button>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonButton } from '@ionic/vue';
import { useRouter } from 'vue-router';

const router = useRouter();
function goToLogin() { router.push('/login'); }
</script>

<style scoped>
.page-home {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: calc(100vh - 120px);
  padding: 20px;
}

#container {
  text-align: center;
  max-width: 640px;
  width: 100%;
  padding: 36px 28px;
  background: var(--ion-surface);
  border-radius: calc(var(--ion-radius) + 4px);
  box-shadow: var(--ion-elevation);
}

#container strong {
  font-size: 20px;
  line-height: 26px;
  color: var(--ion-text-color);
}

#container p {
  font-size: 16px;
  line-height: 22px;
  color: var(--ion-muted);
  margin: 8px 0 0 0;
}

#container a { text-decoration: none; color: var(--ion-color-primary); }

ion-button.cta {
  margin-top: 18px;
  --background: var(--ion-color-primary);
  --color: var(--ion-color-primary-contrast);
  border-radius: 12px;
  box-shadow: 0 10px 24px rgba(37,99,235,0.12);
}

</style>
