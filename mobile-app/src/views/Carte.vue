<template>
    <ion-page>
      <ion-header>
        <ion-toolbar color="primary">
          <ion-buttons slot="start">
            <ion-menu-button></ion-menu-button>
          </ion-buttons>
          <ion-title>
            <div class="header-title">
              <ion-icon :icon="mapOutline"></ion-icon>
              <span>Carte des Signalements</span>
            </div>
          </ion-title>
          <ion-buttons slot="end">
            <ion-button @click="centerOnUser" title="Ma position">
              <ion-icon :icon="locateOutline"></ion-icon>
            </ion-button>
            <ion-button @click="refreshMarkers" title="Actualiser">
              <ion-icon :icon="refreshOutline"></ion-icon>
            </ion-button>
          </ion-buttons>
        </ion-toolbar>
      </ion-header>

      <ion-content class="map-content">
        <!-- Info banner -->
        <div class="info-banner" v-if="showBanner">
          <ion-icon :icon="informationCircleOutline"></ion-icon>
          <span>Cliquez sur la carte pour signaler une route dégradée</span>
          <ion-button fill="clear" size="small" @click="showBanner = false">
            <ion-icon :icon="closeOutline"></ion-icon>
          </ion-button>
        </div>

        <!-- Map container -->
        <div id="map" class="map" />

        <!-- Stats overlay -->
        <div class="map-stats" v-if="stats">
          <div class="stat-chip">
            <ion-icon :icon="alertCircleOutline"></ion-icon>
            <span>{{ stats.total }} signalements</span>
          </div>
        </div>

        <!-- Legend -->
        <div class="map-legend">
          <div class="legend-item">
            <span class="legend-dot nouveau"></span>
            <span>Nouveau</span>
          </div>
          <div class="legend-item">
            <span class="legend-dot encours"></span>
            <span>En cours</span>
          </div>
          <div class="legend-item">
            <span class="legend-dot termine"></span>
            <span>Terminé</span>
          </div>
        </div>

        <!-- FAB buttons -->
        <ion-fab vertical="bottom" horizontal="end" slot="fixed">
          <ion-fab-button color="primary" @click="goToList">
            <ion-icon :icon="listOutline"></ion-icon>
          </ion-fab-button>
        </ion-fab>
      </ion-content>
    </ion-page>
  </template>

  <script setup lang="ts">
  import { ref, onMounted } from 'vue';
  import { useRouter } from 'vue-router';
  import L from 'leaflet';
  import 'leaflet/dist/leaflet.css';
  import {
    IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonButtons,
    IonButton, IonMenuButton, IonIcon, IonFab, IonFabButton
  } from '@ionic/vue';
  import {
    mapOutline, locateOutline, refreshOutline, listOutline,
    informationCircleOutline, closeOutline, alertCircleOutline
  } from 'ionicons/icons';
  import { getSignalements, getSignalementsStats, getLocalSignalements, Signalement } from '../services/signalement';
  import { isAuthenticated } from '../services/auth';

  const router = useRouter();
  const showBanner = ref(true);
  const stats = ref<any>(null);
  let map: L.Map | null = null;
  let markersLayer: L.LayerGroup | null = null;

  onMounted(async () => {
    // Coordonnées d'Antananarivo (latitude, longitude)
    const ANTANANARIVO: [number, number] = [-18.8792, 47.5079];

    map = L.map('map', { preferCanvas: true, zoomControl: false }).setView(ANTANANARIVO, 13);

    // Zoom control en haut à droite
    L.control.zoom({ position: 'topright' }).addTo(map);

    // Utiliser les tuiles OpenStreetMap avec style custom
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap'
    }).addTo(map);

    // Layer group pour les markers
    markersLayer = L.layerGroup().addTo(map);

    // Charger les signalements
    await loadMarkers();

    // Charger les stats
    loadStats();

    // Écouter les nouveaux signalements créés
    const onCreated = (ev: any) => {
      const s = ev?.detail;
      if (!s) return;
      addMarker(s);
    };
    window.addEventListener('signalement:created', onCreated as EventListener);

    // Quand on clique sur la carte, aller vers la page de création de signalement
    map.on('click', (e: any) => {
      const lat = e.latlng?.lat;
      const lng = e.latlng?.lng;
      if (typeof lat === 'number' && typeof lng === 'number') {
        router.push({ name: 'Signalement', query: { lat: String(lat), lng: String(lng) } });
      }
    });

    // Corrige l'affichage dans le conteneur ion-content
    setTimeout(() => map?.invalidateSize(), 200);
  });

  async function loadMarkers() {
    if (!markersLayer || !map) return;
    markersLayer.clearLayers();

    if (isAuthenticated()) {
      try {
        const list = await getSignalements();
        list.forEach(addMarker);
      } catch (err) {
        console.warn('Impossible de charger les signalements depuis l\'API', err);
        const locals = getLocalSignalements();
        locals.forEach(addMarker);
      }
    } else {
      const locals = getLocalSignalements();
      locals.forEach(addMarker);
    }
  }

  async function loadStats() {
    if (!isAuthenticated()) return;
    try {
      stats.value = await getSignalementsStats();
    } catch {
      stats.value = null;
    }
  }

  function addMarker(s: Signalement | any) {
    if (!markersLayer || !map) return;

    let lat: number | undefined;
    let lng: number | undefined;

    if (s.latitude != null && s.longitude != null) {
      lat = Number(s.latitude);
      lng = Number(s.longitude);
    } else if (s.geom?.coordinates) {
      lng = Number(s.geom.coordinates[0]);
      lat = Number(s.geom.coordinates[1]);
    }

    if (lat == null || lng == null || isNaN(lat) || isNaN(lng)) return;

    // Custom icon based on status
    const color = getMarkerColor(s.id_statut);
    const customIcon = L.divIcon({
      className: 'custom-marker',
      html: `<div class="marker-pin" style="background: ${color};">
               <span class="marker-icon">📍</span>
             </div>`,
      iconSize: [30, 42],
      iconAnchor: [15, 42],
      popupAnchor: [0, -42]
    });

    const marker = L.marker([lat, lng], { icon: customIcon }).addTo(markersLayer);
    
    const popupContent = `
      <div class="marker-popup">
        <h4>${s.description ?? 'Signalement'}</h4>
        <p class="popup-date">📅 ${s.date_signalement ?? ''}</p>
        ${s.surface_m2 ? `<p>📐 ${s.surface_m2} m²</p>` : ''}
        ${s.budget ? `<p>💰 ${Number(s.budget).toLocaleString()} Ar</p>` : ''}
        <button class="popup-btn" onclick="window.dispatchEvent(new CustomEvent('view-signalement', { detail: '${s.id_signalement}' }))">
          Voir détails →
        </button>
      </div>
    `;
    marker.bindPopup(popupContent);
  }

  function getMarkerColor(statusId: number): string {
    switch (statusId) {
      case 1: return '#f5576c'; // Nouveau - rouge/rose
      case 2: return '#4facfe'; // En cours - bleu
      case 3: return '#43e97b'; // Terminé - vert
      default: return '#667eea'; // Default - violet
    }
  }

  async function refreshMarkers() {
    await loadMarkers();
    await loadStats();
  }

  function centerOnUser() {
    if (!map) return;
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          map?.setView([pos.coords.latitude, pos.coords.longitude], 15);
        },
        () => {
          console.warn('Géolocalisation non disponible');
        }
      );
    }
  }

  function goToList() {
    router.push({ name: 'SignalementsList' });
  }

  // Listen for popup button clicks
  window.addEventListener('view-signalement', ((ev: CustomEvent) => {
    router.push({ name: 'Signalement', query: { id: ev.detail } });
  }) as EventListener);
  </script>

  <style scoped>
  .map-content {
    position: relative;
    --background: #f0f4f8;
  }

  .header-title {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .header-title ion-icon {
    font-size: 22px;
  }

  .info-banner {
    position: absolute;
    top: 10px;
    left: 10px;
    right: 10px;
    z-index: 1000;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 12px 16px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    gap: 10px;
    box-shadow: 0 4px 20px rgba(102, 126, 234, 0.4);
    animation: slideDown 0.3s ease;
  }

  .info-banner ion-icon {
    font-size: 20px;
  }

  .info-banner span {
    flex: 1;
    font-size: 14px;
  }

  .info-banner ion-button {
    --color: white;
  }

  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .map {
    width: 100%;
    height: 100%;
    position: absolute;
    top: 0;
    left: 0;
  }

  .map-stats {
    position: absolute;
    bottom: 100px;
    left: 10px;
    z-index: 1000;
  }

  .stat-chip {
    background: rgba(255, 255, 255, 0.95);
    padding: 8px 16px;
    border-radius: 20px;
    display: flex;
    align-items: center;
    gap: 8px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    font-size: 13px;
    font-weight: 600;
    color: #4a5568;
  }

  .stat-chip ion-icon {
    color: #667eea;
    font-size: 18px;
  }

  .map-legend {
    position: absolute;
    bottom: 20px;
    left: 10px;
    z-index: 1000;
    background: rgba(255, 255, 255, 0.95);
    padding: 12px 16px;
    border-radius: 12px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: #4a5568;
    margin-bottom: 6px;
  }

  .legend-item:last-child {
    margin-bottom: 0;
  }

  .legend-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
  }

  .legend-dot.nouveau {
    background: #f5576c;
  }

  .legend-dot.encours {
    background: #4facfe;
  }

  .legend-dot.termine {
    background: #43e97b;
  }

  ion-fab-button {
    --background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  }
  </style>

  <style>
  /* Global styles for map markers */
  .custom-marker {
    background: transparent !important;
    border: none !important;
  }

  .marker-pin {
    width: 30px;
    height: 30px;
    border-radius: 50% 50% 50% 0;
    transform: rotate(-45deg);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 3px 10px rgba(0, 0, 0, 0.3);
  }

  .marker-icon {
    transform: rotate(45deg);
    font-size: 14px;
  }

  .marker-popup {
    min-width: 200px;
  }

  .marker-popup h4 {
    margin: 0 0 8px;
    font-size: 14px;
    color: #2d3748;
  }

  .marker-popup p {
    margin: 4px 0;
    font-size: 12px;
    color: #718096;
  }

  .popup-btn {
    margin-top: 10px;
    padding: 8px 16px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-size: 12px;
    width: 100%;
  }

  .popup-btn:hover {
    opacity: 0.9;
  }
  </style>
