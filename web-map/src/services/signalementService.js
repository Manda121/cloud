import config from '../config/config';
import axios from 'axios';

// Données mockées pour les signalements (stockées en localStorage)
const MOCK_SIGNALEMENTS = [
  {
    id_signalement: '1',
    date_signalement: '2026-01-15',
    id_statut: 1,
    surface_m2: 150,
    budget: 5000000,
    description: 'Nid de poule important sur la route principale',
    entreprise_nom: 'COLAS Madagascar',
    id_entreprise: 1,
    geom: { coordinates: [47.5079, -18.8792] }
  },
  {
    id_signalement: '2',
    date_signalement: '2026-01-10',
    id_statut: 2,
    surface_m2: 300,
    budget: 12000000,
    description: 'Route dégradée nécessitant réfection complète',
    entreprise_nom: 'SOGEA SATOM',
    id_entreprise: 2,
    geom: { coordinates: [47.5150, -18.8850] }
  },
  {
    id_signalement: '3',
    date_signalement: '2026-01-05',
    id_statut: 3,
    surface_m2: 80,
    budget: 2500000,
    description: 'Fissures sur chaussée - Travaux terminés',
    entreprise_nom: 'COLAS Madagascar',
    id_entreprise: 1,
    geom: { coordinates: [47.5200, -18.8700] }
  },
  {
    id_signalement: '4',
    date_signalement: '2026-01-20',
    id_statut: 1,
    surface_m2: 200,
    budget: 8000000,
    description: 'Affaissement de la chaussée',
    entreprise_nom: null,
    id_entreprise: null,
    geom: { coordinates: [47.4950, -18.8900] }
  },
  {
    id_signalement: '5',
    date_signalement: '2026-01-18',
    id_statut: 2,
    surface_m2: 450,
    budget: 15000000,
    description: 'Réhabilitation du tronçon Analakely',
    entreprise_nom: 'ENTREPRISE JEAN LEFEBVRE',
    id_entreprise: 3,
    geom: { coordinates: [47.5250, -18.8750] }
  }
];

const MOCK_ENTREPRISES = [
  { id_entreprise: 1, nom: 'COLAS Madagascar', contact: 'contact@colas.mg' },
  { id_entreprise: 2, nom: 'SOGEA SATOM', contact: 'info@sogea-satom.mg' },
  { id_entreprise: 3, nom: 'ENTREPRISE JEAN LEFEBVRE', contact: 'ejl@madagascar.mg' }
];

// Charger les données depuis localStorage ou utiliser les mocks
const loadFromStorage = (key, defaultData) => {
  const stored = localStorage.getItem(key);
  return stored ? JSON.parse(stored) : defaultData;
};

const saveToStorage = (key, data) => {
  localStorage.setItem(key, JSON.stringify(data));
};

const signalementService = {
  // Récupérer tous les signalements
  getAll: async () => {
    const signalements = loadFromStorage('signalements', MOCK_SIGNALEMENTS);
    return Promise.resolve(signalements);
  },

  // Récupérer un signalement par ID
  getById: async (id) => {
    const signalements = loadFromStorage('signalements', MOCK_SIGNALEMENTS);
    const signalement = signalements.find(s => s.id_signalement === id);
    return Promise.resolve(signalement);
  },

  // Créer un nouveau signalement
  create: async (signalement) => {
    const signalements = loadFromStorage('signalements', MOCK_SIGNALEMENTS);
    const newSignalement = {
      ...signalement,
      id_signalement: Date.now().toString(),
      date_signalement: new Date().toISOString().split('T')[0],
      id_statut: 1
    };
    signalements.push(newSignalement);
    saveToStorage('signalements', signalements);
    return Promise.resolve(newSignalement);
  },

  // Mettre à jour un signalement
  update: async (id, data) => {
    const signalements = loadFromStorage('signalements', MOCK_SIGNALEMENTS);
    const index = signalements.findIndex(s => s.id_signalement === id);
    if (index !== -1) {
      // Trouver le nom de l'entreprise si id_entreprise est fourni
      if (data.id_entreprise) {
        const entreprises = loadFromStorage('entreprises', MOCK_ENTREPRISES);
        const entreprise = entreprises.find(e => e.id_entreprise === parseInt(data.id_entreprise));
        data.entreprise_nom = entreprise ? entreprise.nom : null;
      }
      signalements[index] = { ...signalements[index], ...data };
      saveToStorage('signalements', signalements);
      return Promise.resolve(signalements[index]);
    }
    return Promise.reject(new Error('Signalement non trouvé'));
  },

  // Supprimer un signalement
  delete: async (id) => {
    const signalements = loadFromStorage('signalements', MOCK_SIGNALEMENTS);
    const filtered = signalements.filter(s => s.id_signalement !== id);
    saveToStorage('signalements', filtered);
    return Promise.resolve({ success: true });
  },

  // Mettre à jour le statut d'un signalement
  updateStatus: async (id, statusId) => {
    return signalementService.update(id, { id_statut: parseInt(statusId) });
  },

  // Récupérer les statistiques globales
  getStats: async () => {
    const signalements = loadFromStorage('signalements', MOCK_SIGNALEMENTS);
    const stats = {
      nb_signalements: signalements.length,
      surface_totale: signalements.reduce((sum, s) => sum + (s.surface_m2 || 0), 0),
      budget_total: signalements.reduce((sum, s) => sum + (s.budget || 0), 0),
      avancement_pourcentage: signalements.length > 0 
        ? Math.round((signalements.filter(s => s.id_statut === 3).length / signalements.length) * 100)
        : 0
    };
    return Promise.resolve(stats);
  },

  // Synchroniser avec Firebase (simulation)
  syncWithFirebase: async () => {
    // Simulation d'une synchronisation
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ 
          success: true, 
          message: 'Synchronisation simulée réussie (mode local)' 
        });
      }, 1000);
    });
  },

  // Récupérer les entreprises
  getEntreprises: async () => {
    const entreprises = loadFromStorage('entreprises', MOCK_ENTREPRISES);
    return Promise.resolve(entreprises);
  },

  // Récupérer les utilisateurs bloqués via l'API identity-provider
  getBlockedUsers: async () => {
    try {
      const response = await axios.get(`${config.API_AUTH_URL}/blocked-users`);
      return response.data;
    } catch (error) {
      console.error('Erreur récupération utilisateurs bloqués:', error.message);
      return [];
    }
  },

  // Débloquer un utilisateur via l'API identity-provider
  unblockUser: async (userId) => {
    try {
      const response = await axios.post(`${config.API_AUTH_URL}/unblock/${userId}`);
      return response.data;
    } catch (error) {
      console.error('Erreur déblocage utilisateur:', error.message);
      throw error;
    }
  }
};

export default signalementService;
