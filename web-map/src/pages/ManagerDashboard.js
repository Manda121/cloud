import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import signalementService from '../services/signalementService';
import authService from '../services/authService';
import './ManagerDashboard.css';

const ManagerDashboard = () => {
  const [stats, setStats] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState(null);
  const [montantInfo, setMontantInfo] = useState({ prix_unitaire: 0, montant_total: 0 });

  useEffect(() => {
    loadDashboardData();
  }, []);

  const formatMGA = (value) => {
    if (value === null || value === undefined) return '0 MGA';
    return new Intl.NumberFormat('fr-FR').format(value) + ' MGA';
  };

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      const [statsData, statusData, montantsRes] = await Promise.all([
        signalementService.getStats().catch(() => null),
        authService.getStatus().catch(() => null),
        axios.get('/api/config/montants').catch(() => ({ data: { prix_unitaire: 0, signalements: [] } }))
      ]);

      setStats(statsData);
      setConnectionStatus(statusData);
      const mData = montantsRes.data;
      const total = (mData.signalements || []).reduce((s, m) => s + (m.montant || 0), 0);
      setMontantInfo({ prix_unitaire: mData.prix_unitaire || 0, montant_total: total });
    } catch (err) {
      console.error('Erreur:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      setSyncMessage(null);
      
      // Synchronisation bidirectionnelle : Firestore ↔ PostgreSQL
      const result = await signalementService.triggerFullSync('both');
      setSyncMessage({ type: 'success', text: result.message || 'Synchronisation réussie !' });
      
      // Recharger les stats après sync
      const statsData = await signalementService.getStats();
      setStats(statsData);
    } catch (err) {
      setSyncMessage({ 
        type: 'error', 
        text: err.response?.data?.error || 'Erreur lors de la synchronisation' 
      });
    } finally {
      setSyncing(false);
    }
  };

  const refreshConnectivity = async () => {
    try {
      const status = await authService.refreshConnectivity();
      setConnectionStatus(status);
    } catch (err) {
      console.error('Erreur:', err);
    }
  };

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner"></div>
        <p>Chargement du tableau de bord...</p>
      </div>
    );
  }

  return (
    <div className="manager-dashboard">
      <div className="dashboard-header">
        <h1>Tableau de bord Manager</h1>
        <p>Gérez les signalements et les utilisateurs</p>
      </div>

      {/* Statut de connexion */}
      <div className="connection-status">
        <div className={`status-indicator ${connectionStatus?.online ? 'online' : 'offline'}`}>
          <span className="status-dot"></span>
          <span>{connectionStatus?.online ? 'Connecté à Firebase' : 'Mode hors ligne'}</span>
        </div>
        <button onClick={refreshConnectivity} className="btn-refresh-status">
          🔄 Rafraîchir
        </button>
      </div>

      {/* Bouton de synchronisation */}
      <div className="sync-section">
        <button 
          onClick={handleSync} 
          className="btn-sync"
          disabled={syncing}
        >
          {syncing ? '⏳ Synchronisation...' : '🔄 Synchroniser avec Firebase'}
        </button>
        
        {syncMessage && (
          <div className={`sync-message ${syncMessage.type}`}>
            {syncMessage.text}
          </div>
        )}
      </div>

      {/* Statistiques */}
      <div className="dashboard-stats">
        <div className="stat-card">
          <span className="stat-icon">📍</span>
          <div className="stat-info">
            <span className="stat-value">{stats?.nb_signalements || 0}</span>
            <span className="stat-label">Signalements</span>
          </div>
        </div>

        <div className="stat-card">
          <span className="stat-icon">📐</span>
          <div className="stat-info">
            <span className="stat-value">{stats?.surface_totale || 0} m²</span>
            <span className="stat-label">Surface totale</span>
          </div>
        </div>

        <div className="stat-card">
          <span className="stat-icon">📊</span>
          <div className="stat-info">
            <span className="stat-value">{stats?.avancement_pourcentage || 0}%</span>
            <span className="stat-label">Avancement</span>
          </div>
        </div>

        <div className="stat-card">
          <span className="stat-icon">�</span>
          <div className="stat-info">
            <span className="stat-value">{formatMGA(montantInfo.prix_unitaire)} /m²</span>
            <span className="stat-label">Prix unitaire</span>
          </div>
        </div>

        <div className="stat-card">
          <span className="stat-icon">💰</span>
          <div className="stat-info">
            <span className="stat-value">{formatMGA(montantInfo.montant_total)}</span>
            <span className="stat-label">Montant total (prix × surface)</span>
          </div>
        </div>
      </div>

      {/* Actions rapides */}
      <div className="quick-actions">
        <h2>Actions rapides</h2>
        <div className="actions-grid">
          <Link to="/manager/signalements" className="action-card">
            <span className="action-icon">🗺️</span>
            <span className="action-title">Gérer les signalements</span>
            <span className="action-desc">Modifier les statuts, budgets et entreprises</span>
          </Link>

          <Link to="/manager/users" className="action-card">
            <span className="action-icon">👥</span>
            <span className="action-title">Gérer les utilisateurs</span>
            <span className="action-desc">Débloquer les comptes bloqués</span>
          </Link>

          <Link to="/manager/prix" className="action-card">
            <span className="action-icon">💲</span>
            <span className="action-title">Prix unitaire</span>
            <span className="action-desc">Configurer le prix au m² et voir les montants</span>
          </Link>

          <Link to="/" className="action-card">
            <span className="action-icon">🗺️</span>
            <span className="action-title">Voir la carte</span>
            <span className="action-desc">Visualiser tous les signalements</span>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ManagerDashboard;
