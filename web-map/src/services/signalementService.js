import config from '../config/config';
import axios from 'axios';
import firestoreService from './firestoreService';

// URL de base pour les API locales (serveur web-map)
const API_URL = '/api/signalements';
const STATS_URL = '/api/stats';
const ENTREPRISES_URL = '/api/entreprises';
const SYNC_URL = '/api/sync';

const signalementService = {
  // =====================================================
  // SIGNALEMENTS
  // =====================================================

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

  // Récupérer les signalements d'un utilisateur spécifique
  getByUser: async (userId) => {
    try {
      const response = await axios.get(`${API_URL}?user_id=${userId}`);
      return response.data;
    } catch (error) {
      console.error('Erreur getByUser signalements:', error.message);
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

  // =====================================================
  // STATISTIQUES / DASHBOARD
  // =====================================================

  // Récupérer les statistiques globales
  getStats: async () => {
    try {
      const response = await axios.get(STATS_URL);
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

  // Récupérer les statistiques par statut
  getStatsByStatus: async () => {
    try {
      const response = await axios.get(`${STATS_URL}/by-status`);
      return response.data;
    } catch (error) {
      console.error('Erreur getStatsByStatus:', error.message);
      return [];
    }
  },

  // Récupérer les statistiques par entreprise
  getStatsByEntreprise: async () => {
    try {
      const response = await axios.get(`${STATS_URL}/by-entreprise`);
      return response.data;
    } catch (error) {
      console.error('Erreur getStatsByEntreprise:', error.message);
      return [];
    }
  },

  // =====================================================
  // ENTREPRISES
  // =====================================================

  // Récupérer les entreprises
  getEntreprises: async () => {
    try {
      const response = await axios.get(ENTREPRISES_URL);
      return response.data;
    } catch (error) {
      console.error('Erreur getEntreprises:', error.message);
      return [];
    }
  },

  // =====================================================
  // SYNCHRONISATION FIREBASE (via Firestore client + web-map backend)
  // Le frontend lit/écrit Firestore (miranto-mobile),
  // le backend web-map gère PostgreSQL.
  // =====================================================

  // Pull: Lire Firestore → envoyer au backend pour upsert dans PostgreSQL
  syncWithFirebase: async () => {
    try {
      // 1. Lire tous les signalements depuis Firestore (miranto-mobile)
      const firestoreSignalements = await firestoreService.getAll();
      console.log(`[Sync] ${firestoreSignalements.length} signalements lus depuis Firestore`);

      if (firestoreSignalements.length === 0) {
        return { success: true, message: 'Aucun signalement dans Firestore', data: { created: [], updated: [], skipped: [] } };
      }

      // 2. Envoyer au backend web-map pour upsert dans PostgreSQL
      const response = await axios.post(`${SYNC_URL}/pull`, {
        signalements: firestoreSignalements
      });
      return response.data;
    } catch (error) {
      console.error('Erreur syncWithFirebase:', error.message);
      throw error;
    }
  },

  // Push: Lire les non-synchronisés depuis PostgreSQL → écrire dans Firestore
  pushToFirebase: async () => {
    try {
      // 1. Récupérer les signalements non synchronisés depuis le backend
      const response = await axios.get(`${SYNC_URL}/unsynced`);
      const unsyncedList = response.data.signalements || [];
      console.log(`[Sync] ${unsyncedList.length} signalements à pousser vers Firestore`);

      const results = { pushed: [], failed: [] };

      // 2. Écrire chaque signalement dans Firestore (miranto-mobile)
      for (const sig of unsyncedList) {
        try {
          await firestoreService.createWithId(String(sig.id_signalement), {
            id_signalement: sig.id_signalement,
            id_user: sig.id_user,
            id_statut: sig.id_statut,
            description: sig.description,
            surface_m2: sig.surface_m2,
            budget: sig.budget,
            date_signalement: sig.date_signalement,
            longitude: sig.longitude,
            latitude: sig.latitude
          });
          results.pushed.push(sig.id_signalement);
        } catch (err) {
          console.error(`[Sync] Erreur push signalement ${sig.id_signalement}:`, err.message);
          results.failed.push(sig.id_signalement);
        }
      }

      // 3. Marquer les signalements poussés comme synchronisés dans PostgreSQL
      if (results.pushed.length > 0) {
        await axios.post(`${SYNC_URL}/mark-synced`, { ids: results.pushed });
      }

      return {
        success: true,
        message: `${results.pushed.length} signalements poussés vers Firestore`,
        data: results
      };
    } catch (error) {
      console.error('Erreur pushToFirebase:', error.message);
      throw error;
    }
  },

  // Synchronisation bidirectionnelle
  triggerFullSync: async (direction = 'both') => {
    try {
      const result = { pull: null, push: null };

      if (direction === 'pull' || direction === 'both') {
        result.pull = await signalementService.syncWithFirebase();
      }
      if (direction === 'push' || direction === 'both') {
        result.push = await signalementService.pushToFirebase();
      }

      let message = 'Synchronisation terminée';
      if (result.pull && result.pull.data) {
        message += ` | Pull: ${result.pull.data.created?.length || 0} créés, ${result.pull.data.updated?.length || 0} mis à jour`;
      }
      if (result.push && result.push.data) {
        message += ` | Push: ${result.push.data.pushed?.length || 0} envoyés`;
      }

      return { success: true, message, data: result };
    } catch (error) {
      console.error('Erreur triggerFullSync:', error.message);
      throw error;
    }
  },

  // Statistiques de synchronisation
  getSyncStats: async () => {
    try {
      const response = await axios.get(`${SYNC_URL}/stats`);
      return response.data;
    } catch (error) {
      console.error('Erreur getSyncStats:', error.message);
      return null;
    }
  },

  // =====================================================
  // GESTION UTILISATEURS (via identity-provider)
  // =====================================================

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
