<template>
    <ion-page>
      <ion-header>
        <ion-toolbar>
          <ion-title>Carte</ion-title>
        </ion-toolbar>
      </ion-header>

      <ion-content class="ion-padding content">
        <div id="map" class="map" />
      </ion-content>
    </ion-page>
  </template>

  <script setup lang="ts">
  import { onMounted } from 'vue';
  import { useRouter } from 'vue-router';
  import L from 'leaflet';
  import 'leaflet/dist/leaflet.css';
  import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar } from '@ionic/vue';

  onMounted(() => {
    // Coordonnées d'Antananarivo (latitude, longitude)
    const ANTANANARIVO: [number, number] = [-18.8792, 47.5079];

    const map = L.map('map', { preferCanvas: true }).setView(ANTANANARIVO, 13);

    const router = useRouter();

    // Utiliser les tuiles OpenStreetMap en ligne
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    // Base API (utiliser la variable d'env VITE_API_URL si fournie)
    const API_BASE = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:3000';

    // Charger les signalements depuis l'API et les afficher
    fetch(`${API_BASE}/signalements`)
      .then(r => r.json())
      .then((list: any[]) => {
        list.forEach(s => {
          if (s.lat == null || s.lng == null) return;
          const marker = L.marker([s.lat, s.lng]).addTo(map);
          const popupContent = `<strong>${s.description ?? 'Signalement'}</strong><br>${s.date_signalement ?? ''}`;
          marker.bindPopup(popupContent);
          marker.on('click', () => {
            // Aller vers la page de détail du signalement
            router.push({ name: 'Signalement', query: { id: s.id_signalement } });
          });
        });
      })
      .catch(err => console.warn('Impossible de charger les signalements depuis l\'API', err));
    
    // Si l'API n'est pas disponible, afficher les signalements locaux stockés
    function loadLocalSignalements() {
      try {
        const raw = localStorage.getItem('signalements');
        if (!raw) return;
        const list = JSON.parse(raw);
        list.forEach((s: any) => {
          const coords = s?.geom?.coordinates;
          if (!coords || coords.length < 2) return;
          const marker = L.marker([coords[1], coords[0]]).addTo(map);
          marker.bindPopup(`<strong>${s.description ?? 'Signalement local'}</strong><br>${s.date_signalement ?? ''}`);
          marker.on('click', () => router.push({ name: 'Signalement', query: { id: s.id_signalement } }));
        });
      } catch (err) {
        console.warn('Impossible de charger signalements locaux', err);
      }
    }

    // call it once in case API not reachable
    loadLocalSignalements();

    // Écouter les nouveaux signalements créés (pour ajouter un marker immédiatement)
    const onCreated = (ev: any) => {
      const s = ev?.detail;
      if (!s) return;
      // server returns lng/lat, local objects have geom.coordinates
      let lat: number | undefined;
      let lng: number | undefined;
      if (s.lat != null && s.lng != null) {
        lat = Number(s.lat);
        lng = Number(s.lng);
      } else if (s.geom?.coordinates) {
        lng = Number(s.geom.coordinates[0]);
        lat = Number(s.geom.coordinates[1]);
      }
      if (lat == null || lng == null) return;
      const marker = L.marker([lat, lng]).addTo(map);
      marker.bindPopup(`<strong>${s.description ?? 'Signalement'}</strong><br>${s.date_signalement ?? ''}`);
      marker.on('click', () => router.push({ name: 'Signalement', query: { id: s.id_signalement } }));
    };
    window.addEventListener('signalement:created', onCreated as EventListener);

    // cleanup listener when component is destroyed
    // (Ionic/Vue will remove when page unmounted, but keep this for completeness)
    // Note: since we are in onMounted and not returning onUnmounted, this is a simple addition.

    // Quand on clique sur la carte, aller vers la page de création de signalement
    map.on('click', (e: any) => {
      const lat = e.latlng?.lat;
      const lng = e.latlng?.lng;
      if (typeof lat === 'number' && typeof lng === 'number') {
        router.push({ name: 'Signalement', query: { lat: String(lat), lng: String(lng) } });
      }
    });

    // Corrige l'affichage dans le conteneur ion-content
    setTimeout(() => map.invalidateSize(), 200);
  });
  </script>

  <style scoped>
  .content { position: relative; height: 100%; }
  .map { width: 100%; height: calc(100vh - 56px); border-radius: 6px; overflow: hidden; }
  .placeholder { position: absolute; left: 16px; right: 16px; top: 40%; transform: translateY(-50%); padding: 20px; background: #fff3cd; color: #856404; border-radius: 6px; text-align: center; }
  </style>
