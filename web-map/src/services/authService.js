import axios from 'axios';
import config from '../config/config';

const api = axios.create({
  baseURL: config.API_AUTH_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Intercepteur pour ajouter le token aux requêtes
api.interceptors.request.use((reqConfig) => {
  const token = localStorage.getItem('token');
  if (token) {
    reqConfig.headers.Authorization = `Bearer ${token}`;
  }
  return reqConfig;
});

// Intercepteur pour gérer les erreurs d'authentification
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Si le token est expiré ou invalide, déconnecter l'utilisateur
    if (error.response?.status === 401 || error.response?.status === 403) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // Ne pas rediriger ici, laisser le contexte gérer
    }
    return Promise.reject(error);
  }
);

const authService = {
  // Inscription
  register: async (email, password, firstname, lastname) => {
    const response = await api.post('/register', {
      email,
      password,
      firstname,
      lastname
    });
    return response.data;
  },

  // Connexion
  login: async (email, password) => {
    const response = await api.post('/login', { email, password });
    if (response.data.token) {
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
    }
    return response.data;
  },

  // Déconnexion
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },

  // Débloquer un compte
  unblock: async (email) => {
    const response = await api.post('/unblock', { email });
    return response.data;
  },

  // Vérifier le statut de connectivité
  getStatus: async () => {
    const response = await api.get('/status');
    return response.data;
  },

  // Rafraîchir la connectivité
  refreshConnectivity: async () => {
    const response = await api.post('/refresh-connectivity');
    return response.data;
  },

  // Obtenir l'utilisateur actuel
  getCurrentUser() {
    const userStr = localStorage.getItem("user");

    // 🔒 Protection
    if (!userStr || userStr === "undefined") {
      return null;
    }

    try {
      return JSON.parse(userStr);
    } catch (error) {
      console.error("Utilisateur invalide dans localStorage :", error);
      localStorage.removeItem("user");
      return null;
    }
  },

  // Vérifier si l'utilisateur est connecté
  isAuthenticated: () => {
    return !!localStorage.getItem('token');
  },

  // Obtenir le token
  getToken: () => {
    return localStorage.getItem('token');
  },

  // Valider le token auprès du serveur
  validateToken: async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      return { valid: false };
    }
    
    try {
      const response = await api.get('/validate');
      return { valid: true, user: response.data.user };
    } catch (error) {
      // Token invalide ou expiré
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      return { valid: false };
    }
  }
};

export default authService;
