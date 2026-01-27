// Configuration de l'application
const config = {
  // URL de l'API d'authentification (identity-provider)
  API_AUTH_URL: process.env.REACT_APP_API_AUTH_URL || 'http://localhost:3000/api/auth',
  
  // URL de l'API des signalements
  API_SIGNALEMENTS_URL: process.env.REACT_APP_API_SIGNALEMENTS_URL || 'http://localhost:3000/api',
  
  // URL du serveur de tuiles (pour les cartes offline)
  TILE_SERVER_URL: process.env.REACT_APP_TILE_SERVER_URL || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  
  // Coordonnées par défaut (Antananarivo)
  DEFAULT_CENTER: [-18.8792, 47.5079],
  DEFAULT_ZOOM: 13,
  
  // Statuts des signalements
  STATUTS: {
    1: { label: 'Nouveau', color: '#e74c3c' },
    2: { label: 'En cours', color: '#f39c12' },
    3: { label: 'Terminé', color: '#27ae60' }
  }
};

export default config;
