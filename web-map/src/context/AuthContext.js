import React, { createContext, useState, useContext, useEffect } from 'react';
import authService from '../services/authService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Vérifier si l'utilisateur est déjà connecté au chargement
    const checkAuth = async () => {
      const token = authService.getToken();
      const storedUser = authService.getCurrentUser();
      
      if (token && storedUser) {
        try {
          // Valider le token auprès du serveur
          const validation = await authService.validateToken();
          
          if (validation.valid) {
            // Token valide, utiliser les données du serveur ou du localStorage
            setUser(validation.user || storedUser);
            setIsAuthenticated(true);
          } else {
            // Token invalide, nettoyer
            setUser(null);
            setIsAuthenticated(false);
          }
        } catch (error) {
          console.error('Erreur validation token:', error);
          // En cas d'erreur réseau, utiliser les données locales si disponibles
          // pour permettre un mode "offline" basique
          setUser(storedUser);
          setIsAuthenticated(true);
        }
      }
      setLoading(false);
    };

    checkAuth();
  }, []);

  const login = async (email, password) => {
    try {
      const data = await authService.login(email, password);
      setUser(data.user);
      setIsAuthenticated(true);
      return { success: true, data };
    } catch (error) {
      const message = error.response?.data?.error || 'Erreur de connexion';
      return { success: false, error: message };
    }
  };

  const register = async (email, password, firstname, lastname) => {
    try {
      const data = await authService.register(email, password, firstname, lastname);
      return { success: true, data };
    } catch (error) {
      const message = error.response?.data?.error || 'Erreur d\'inscription';
      return { success: false, error: message };
    }
  };

  const logout = () => {
    authService.logout();
    setUser(null);
    setIsAuthenticated(false);
  };

  const unblock = async (email) => {
    try {
      const data = await authService.unblock(email);
      return { success: true, data };
    } catch (error) {
      const message = error.response?.data?.error || 'Erreur lors du déblocage';
      return { success: false, error: message };
    }
  };

  const value = {
    user,
    loading,
    isAuthenticated,
    login,
    register,
    logout,
    unblock
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth doit être utilisé dans un AuthProvider');
  }
  return context;
};

export default AuthContext;
