<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>Nouveau signalement</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <template v-if="viewing">
        <ion-item>
          <ion-label position="stacked">Coordonnées</ion-label>
          <div style="padding: 8px 0">{{ remoteData?.geom_geojson ? JSON.parse(remoteData.geom_geojson)?.coordinates.reverse().join(' , ') : (lat + ' , ' + lng) }}</div>
        </ion-item>

        <ion-item>
          <ion-label position="stacked">Description</ion-label>
          <div style="padding:8px 0">{{ description }}</div>
        </ion-item>

        <ion-item>
          <ion-label position="stacked">Surface (m²)</ion-label>
          <div style="padding:8px 0">{{ surface_m2 }}</div>
        </ion-item>

        <ion-item>
          <ion-label position="stacked">Budget</ion-label>
          <div style="padding:8px 0">{{ budget }}</div>
        </ion-item>

        <ion-item>
          <ion-label position="stacked">Date</ion-label>
          <div style="padding:8px 0">{{ date_signalement }}</div>
        </ion-item>

        <div style="margin-top: 16px; display:flex; gap:8px;">
          <ion-button @click="goBack">Retour</ion-button>
        </div>
      </template>

      <template v-else>
        <form @submit.prevent="onSubmit">
          <ion-item>
            <ion-label position="stacked">Coordonnées</ion-label>
            <div style="padding: 8px 0">Lat: <strong>{{ lat }}</strong> — Lng: <strong>{{ lng }}</strong></div>
          </ion-item>

          <ion-item>
            <ion-label position="stacked">Description</ion-label>
            <ion-textarea v-model="description" rows="4" />
          </ion-item>

          <ion-item>
            <ion-label position="stacked">Surface (m²)</ion-label>
            <ion-input type="number" v-model.number="surface_m2" />
          </ion-item>

          <ion-item>
            <ion-label position="stacked">Budget</ion-label>
            <ion-input type="number" step="0.01" v-model.number="budget" />
          </ion-item>

          <ion-item>
            <ion-label position="stacked">Date</ion-label>
            <ion-datetime v-model="date_signalement" presentation="date"></ion-datetime>
          </ion-item>

          <div style="margin-top: 16px; display:flex; gap:8px;">
            <ion-button type="submit">Enregistrer</ion-button>
            <ion-button color="medium" @click="goBack" type="button">Annuler</ion-button>
          </div>

          <div v-if="saved" style="margin-top:16px;">
            ✅ Signalement enregistré localement.
          </div>
        </form>
      </template>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { IonButton, IonContent, IonHeader, IonInput, IonItem, IonLabel, IonPage, IonTextarea, IonTitle, IonToolbar, IonDatetime } from '@ionic/vue';

const route = useRoute();
const router = useRouter();

const lat = computed(() => Number.parseFloat((route.query.lat as string) || '0'));
const lng = computed(() => Number.parseFloat((route.query.lng as string) || '0'));

const description = ref('');
const surface_m2 = ref<number | null>(null);
const budget = ref<number | null>(null);
const date_signalement = ref<string>(new Date().toISOString().slice(0, 10));
const saved = ref(false);
const viewing = ref(false);
const remoteData = ref<any | null>(null);

const API_BASE = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:3000';

onMounted(() => {
  const id = (route.query.id as string) || null;
  if (id) {
    viewing.value = true;
    fetch(`${API_BASE}/signalements/${encodeURIComponent(id)}`)
      .then(r => {
        if (!r.ok) throw new Error('Not found');
        return r.json();
      })
      .then(d => {
        remoteData.value = d;
        // fill fields for display
        description.value = d.description ?? '';
        surface_m2.value = d.surface_m2 ?? null;
        budget.value = d.budget ?? null;
        date_signalement.value = d.date_signalement ?? date_signalement.value;
      })
      .catch(err => {
        console.warn('Fetch signalement failed', err);
      });
  }
});

function getStoredSignalements(): any[] {
  try {
    const raw = localStorage.getItem('signalements');
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.warn('Could not parse stored signalements', err);
    return [];
  }
}

function saveStoredSignalements(list: any[]) {
  localStorage.setItem('signalements', JSON.stringify(list));
}

function onSubmit() {
  const id_signalement = (crypto as any).randomUUID ? (crypto as any).randomUUID() : String(Date.now());
  const s = {
    id_signalement,
    description: description.value,
    surface_m2: surface_m2.value,
    budget: budget.value,
    date_signalement: date_signalement.value,
    geom: {
      type: 'Point',
      coordinates: [lng.value, lat.value]
    },
    source: 'LOCAL',
    synced: false,
    created_at: new Date().toISOString()
  };

  const list = getStoredSignalements();
  list.push(s);
  saveStoredSignalements(list);

  // Try to POST to the API; if it fails, keep the local copy
  fetch(`${API_BASE}/signalements`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      description: s.description,
      surface_m2: s.surface_m2,
      budget: s.budget,
      date_signalement: s.date_signalement,
      lng: s.geom.coordinates[0],
      lat: s.geom.coordinates[1],
      source: s.source
    })
  })
    .then(async (r) => {
      if (!r.ok) throw new Error('Failed to persist');
      const created = await r.json();
      // mark local copy as synced and update id if needed
      const stored = getStoredSignalements();
      const idx = stored.findIndex((x: any) => x.id_signalement === id_signalement);
      if (idx >= 0) {
        stored[idx].synced = true;
        stored[idx].id_signalement_server = created.id_signalement ?? created.id;
        saveStoredSignalements(stored);
      }
      saved.value = true;
      setTimeout(() => router.push({ name: 'Carte' }), 800);
      return created;
    })
    .then((created) => {
      // notify map about created signalement (server copy)
      try { window.dispatchEvent(new CustomEvent('signalement:created', { detail: created })); } catch(_) {}
    })
    .catch((err) => {
      console.warn('POST signalement failed, saved locally', err);
      // still show saved and go back
        // dispatch a local event so the map can add the marker immediately
        try { window.dispatchEvent(new CustomEvent('signalement:created', { detail: s })); } catch(_) {}
      saved.value = true;
      setTimeout(() => router.push({ name: 'Carte' }), 900);
    });
}

function goBack() {
  router.back();
}
</script>
<style scoped>
.form-row { margin-bottom: 12px; }
</style>
