// Configuration de l'application
const config = {
  // URL de l'API d'authentification (identity-provider)
  API_AUTH_URL: process.env.REACT_APP_API_AUTH_URL || 'http://localhost:3001/api/auth',
  
  // URL de l'API des signalements (à créer - pour l'instant on utilise des données mockées)
  API_SIGNALEMENTS_URL: process.env.REACT_APP_API_SIGNALEMENTS_URL || 'http://localhost:3001/api',
  
  // Centre de la carte - Antananarivo
  MAP_CENTER: [-18.8792, 47.5079],
  MAP_ZOOM: 13,
  
  // URL du serveur de tuiles (offline ou online)
  TILE_SERVER_URL: process.env.REACT_APP_TILE_SERVER_URL || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  TILE_ATTRIBUTION: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  
  // Statuts des signalements
  STATUTS: {
    1: { label: 'Nouveau', color: '#f44336' },      // Rouge
    2: { label: 'En cours', color: '#ff9800' },     // Orange
    3: { label: 'Terminé', color: '#4caf50' }       // Vert
  }
};

export default config;
