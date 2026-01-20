import axios from 'axios';
import config from '../config/config';

const API_URL = config.API_SIGNALEMENTS_URL;

/**
 * Service pour gérer les signalements
 * Note: Pour l'instant, utilise des données mockées
 * À remplacer par de vraies requêtes API quand le backend sera prêt
 */

// Données mockées pour le développement
const mockSignalements = [
  {
    id_signalement: '1',
    description: 'Nid de poule important - Avenue de l\'Indépendance',
    latitude: -18.8792,
    longitude: 47.5079,
    date_signalement: '2026-01-15',
    id_statut: 1,
    surface_m2: 15.5,
    budget: 250000,
    entreprise_nom: 'BTP Madagascar'
  },
  {
    id_signalement: '2',
    description: 'Route dégradée - Rue Rainitovo',
    latitude: -18.8850,
    longitude: 47.5150,
    date_signalement: '2026-01-10',
    id_statut: 2,
    surface_m2: 45.0,
    budget: 750000,
    entreprise_nom: 'Colas Madagascar'
  },
  {
    id_signalement: '3',
    description: 'Affaissement de chaussée - Boulevard Ratsimilaho',
    latitude: -18.8720,
    longitude: 47.5000,
    date_signalement: '2025-12-20',
    id_statut: 3,
    surface_m2: 28.0,
    budget: 450000,
    entreprise_nom: 'SOGEA SATOM'
  },
  {
    id_signalement: '4',
    description: 'Fissures multiples - Rue Dr Raseta',
    latitude: -18.8900,
    longitude: 47.5200,
    date_signalement: '2026-01-18',
    id_statut: 1,
    surface_m2: 32.5,
    budget: 500000,
    entreprise_nom: null
  },
  {
    id_signalement: '5',
    description: 'Réfection totale - Avenue de France',
    latitude: -18.8750,
    longitude: 47.5100,
    date_signalement: '2025-11-15',
    id_statut: 2,
    surface_m2: 120.0,
    budget: 2500000,
    entreprise_nom: 'Colas Madagascar'
  }
];

const mockEntreprises = [
  { id_entreprise: 1, nom: 'BTP Madagascar', contact: 'contact@btp-mada.mg' },
  { id_entreprise: 2, nom: 'Colas Madagascar', contact: 'info@colas.mg' },
  { id_entreprise: 3, nom: 'SOGEA SATOM', contact: 'contact@sogea-satom.mg' },
  { id_entreprise: 4, nom: 'RAVINALA TP', contact: 'ravinala@tp.mg' }
];

const mockBlockedUsers = [
  { id_user: 1, email: 'user1@test.com', firstname: 'Jean', lastname: 'Dupont', attempts: 3 },
  { id_user: 2, email: 'user2@test.com', firstname: 'Marie', lastname: 'Martin', attempts: 5 }
];

const signalementService = {
  /**
   * Récupérer tous les signalements
   */
  getAll: async () => {
    // TODO: Remplacer par un vrai appel API
    // const response = await axios.get(`${API_URL}/signalements`);
    // return response.data;
    
    return new Promise((resolve) => {
      setTimeout(() => resolve(mockSignalements), 500);
    });
  },

  /**
   * Récupérer un signalement par ID
   */
  getById: async (id) => {
    // TODO: Remplacer par un vrai appel API
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(mockSignalements.find(s => s.id_signalement === id));
      }, 300);
    });
  },

  /**
   * Mettre à jour un signalement
   */
  update: async (id, data) => {
    // TODO: Remplacer par un vrai appel API
    // const response = await axios.put(`${API_URL}/signalements/${id}`, data);
    // return response.data;
    
    return new Promise((resolve) => {
      const index = mockSignalements.findIndex(s => s.id_signalement === id);
      if (index !== -1) {
        mockSignalements[index] = { ...mockSignalements[index], ...data };
      }
      setTimeout(() => resolve(mockSignalements[index]), 300);
    });
  },

  /**
   * Calculer les statistiques de récapitulation
   */
  getStats: async () => {
    const signalements = await signalementService.getAll();
    
    const totalPoints = signalements.length;
    const totalSurface = signalements.reduce((sum, s) => sum + (s.surface_m2 || 0), 0);
    const totalBudget = signalements.reduce((sum, s) => sum + (s.budget || 0), 0);
    
    const termines = signalements.filter(s => s.id_statut === 3).length;
    const avancement = totalPoints > 0 ? (termines / totalPoints) * 100 : 0;
    
    return {
      totalPoints,
      totalSurface,
      totalBudget,
      avancement: avancement.toFixed(1)
    };
  },

  /**
   * Récupérer la liste des entreprises
   */
  getEntreprises: async () => {
    // TODO: Remplacer par un vrai appel API
    return new Promise((resolve) => {
      setTimeout(() => resolve(mockEntreprises), 300);
    });
  },

  /**
   * Récupérer les utilisateurs bloqués
   */
  getBlockedUsers: async () => {
    // TODO: Remplacer par un vrai appel API
    return new Promise((resolve) => {
      setTimeout(() => resolve(mockBlockedUsers), 300);
    });
  },

  /**
   * Synchroniser avec Firebase
   */
  syncWithFirebase: async () => {
    // TODO: Implémenter la synchronisation avec Firebase
    return new Promise((resolve) => {
      setTimeout(() => resolve({ message: 'Synchronisation réussie', synced: 5 }), 1000);
    });
  }
};

export default signalementService;
