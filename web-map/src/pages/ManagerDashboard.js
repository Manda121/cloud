import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import signalementService from '../services/signalementService';
import authService from '../services/authService';
import './ManagerDashboard.css';

const ManagerDashboard = () => {
  const [stats, setStats] = useState(null);
  const [apiStatus, setApiStatus] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [statsData, statusData] = await Promise.all([
        signalementService.getStats(),
        authService.getStatus().catch(() => ({ online: false, authMode: 'local' }))
      ]);
      setStats(statsData);
      setApiStatus(statusData);
    } catch (err) {
      console.error('Erreur chargement dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      setSyncMessage('');
      const result = await signalementService.syncWithFirebase();
      setSyncMessage(`✅ ${result.message} - ${result.synced} éléments synchronisés`);
    } catch (err) {
      setSyncMessage('❌ Erreur lors de la synchronisation');
    } finally {
      setSyncing(false);
    }
  };

  const formatCurrency = (amount) => {
    if (!amount) return '0 MGA';
    return new Intl.NumberFormat('fr-MG', {
      style: 'currency',
      currency: 'MGA',
      maximumFractionDigits: 0
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="dashboard-page">
        <div className="loader">
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <div className="container">
        <h1 className="page-title">Dashboard Manager</h1>
        
        {/* Statut de connexion */}
        <div className="status-bar card">
          <div className="status-item">
            <span className={`status-indicator ${apiStatus?.online ? 'online' : 'offline'}`}></span>
            <span>Mode: {apiStatus?.authMode === 'firebase' ? 'En ligne (Firebase)' : 'Hors ligne (Local)'}</span>
          </div>
          
          <button 
            className="btn btn-primary"
            onClick={handleSync}
            disabled={syncing}
          >
            {syncing ? '🔄 Synchronisation...' : '🔄 Synchroniser avec Firebase'}
          </button>
        </div>
        
        {syncMessage && (
          <div className={`message ${syncMessage.includes('❌') ? 'error-message' : 'success-message'}`}>
            {syncMessage}
          </div>
        )}
        
        {/* Statistiques */}
        <div className="stats-cards">
          <div className="stat-card-large card">
            <h3>📍 Signalements</h3>
            <div className="stat-number">{stats?.totalPoints || 0}</div>
            <p>Points signalés au total</p>
          </div>
          
          <div className="stat-card-large card">
            <h3>📐 Surface</h3>
            <div className="stat-number">{stats?.totalSurface?.toFixed(1) || 0} m²</div>
            <p>Surface totale à traiter</p>
          </div>
          
          <div className="stat-card-large card">
            <h3>📊 Avancement</h3>
            <div className="stat-number">{stats?.avancement || 0}%</div>
            <div className="progress-bar-large">
              <div 
                className="progress-fill-large" 
                style={{ width: `${stats?.avancement || 0}%` }}
              ></div>
            </div>
          </div>
          
          <div className="stat-card-large card">
            <h3>💰 Budget</h3>
            <div className="stat-number">{formatCurrency(stats?.totalBudget)}</div>
            <p>Budget total alloué</p>
          </div>
        </div>
        
        {/* Actions rapides */}
        <div className="quick-actions card">
          <h3>Actions rapides</h3>
          <div className="actions-grid">
            <Link to="/manager/signalements" className="action-card">
              <span className="action-icon">📝</span>
              <span className="action-text">Gérer les signalements</span>
            </Link>
            
            <Link to="/manager/users" className="action-card">
              <span className="action-icon">👥</span>
              <span className="action-text">Gérer les utilisateurs</span>
            </Link>
            
            <Link to="/" className="action-card">
              <span className="action-icon">🗺️</span>
              <span className="action-text">Voir la carte</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManagerDashboard;
