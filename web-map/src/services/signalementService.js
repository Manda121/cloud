import config from '../config/config';
import axios from 'axios';

// URL de base pour l'API signalements
const API_URL = config.API_SIGNALEMENTS_URL + '/signalements';

const signalementService = {
  // Récupérer tous les signalements depuis la base de données
  getAll: async () => {
    try {
      const response = await axios.get(API_URL);
      return response.data;
    } catch (error) {
      console.error('Erreur getAll signalements:', error.message);
      return [];
    }
  },

  // Récupérer un signalement par ID
  getById: async (id) => {
    try {
      const response = await axios.get(`${API_URL}/${id}`);
      return response.data;
    } catch (error) {
      console.error('Erreur getById signalement:', error.message);
      return null;
    }
  },

  // Créer un nouveau signalement
  create: async (signalement) => {
    try {
      const response = await axios.post(API_URL, signalement);
      return response.data;
    } catch (error) {
      console.error('Erreur create signalement:', error.message);
      throw error;
    }
  },

  // Mettre à jour un signalement
  update: async (id, data) => {
    try {
      const response = await axios.put(`${API_URL}/${id}`, data);
      return response.data;
    } catch (error) {
      console.error('Erreur update signalement:', error.message);
      throw error;
    }
  },

  // Supprimer un signalement
  delete: async (id) => {
    try {
      const response = await axios.delete(`${API_URL}/${id}`);
      return response.data;
    } catch (error) {
      console.error('Erreur delete signalement:', error.message);
      throw error;
    }
  },

  // Mettre à jour le statut d'un signalement
  updateStatus: async (id, statusId, managerId = null) => {
    try {
      const response = await axios.patch(`${API_URL}/${id}/status`, { 
        id_statut: parseInt(statusId),
        id_manager: managerId
      });
      return response.data;
    } catch (error) {
      console.error('Erreur updateStatus signalement:', error.message);
      throw error;
    }
  },

  // Récupérer les statistiques globales
  getStats: async () => {
    try {
      const response = await axios.get(`${API_URL}/stats/global`);
      return response.data;
    } catch (error) {
      console.error('Erreur getStats:', error.message);
      return {
        nb_signalements: 0,
        surface_totale: 0,
        budget_total: 0,
        avancement_pourcentage: 0
      };
    }
  },

  // Synchroniser avec Firebase (placeholder pour future implémentation)
  syncWithFirebase: async () => {
    return { 
      success: true, 
      message: 'Synchronisation en cours de développement' 
    };
  },

  // Récupérer les entreprises
  getEntreprises: async () => {
    try {
      const response = await axios.get(`${API_URL}/entreprises/list`);
      return response.data;
    } catch (error) {
      console.error('Erreur getEntreprises:', error.message);
      return [];
    }
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
