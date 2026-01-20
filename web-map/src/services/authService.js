import axios from 'axios';
import config from '../config/config';

const API_URL = config.API_AUTH_URL;

/**
 * Service d'authentification - Utilise l'API identity-provider
 */
const authService = {
  /**
   * Inscription d'un nouvel utilisateur
   */
  register: async (email, password, firstname, lastname) => {
    const response = await axios.post(`${API_URL}/register`, {
      email,
      password,
      firstname,
      lastname
    });
    return response.data;
  },

  /**
   * Connexion d'un utilisateur
   */
  login: async (email, password) => {
    const response = await axios.post(`${API_URL}/login`, {
      email,
      password
    });
    
    if (response.data.token) {
      localStorage.setItem('user', JSON.stringify(response.data));
    }
    
    return response.data;
  },

  /**
   * Déconnexion
   */
  logout: () => {
    localStorage.removeItem('user');
  },

  /**
   * Récupérer l'utilisateur courant depuis le localStorage
   */
  getCurrentUser: () => {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  },

  /**
   * Vérifier le statut de l'API (online/offline)
   */
  getStatus: async () => {
    const response = await axios.get(`${API_URL}/status`);
    return response.data;
  },

  /**
   * Débloquer un utilisateur (pour les managers)
   */
  unblockUser: async (email) => {
    const response = await axios.post(`${API_URL}/unblock`, { email });
    return response.data;
  },

  /**
   * Rafraîchir le cache de connectivité
   */
  refreshConnectivity: async () => {
    const response = await axios.post(`${API_URL}/refresh-connectivity`);
    return response.data;
  }
};

export default authService;
