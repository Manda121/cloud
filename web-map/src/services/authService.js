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
  }
};

export default authService;
