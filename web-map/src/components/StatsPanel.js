import React from 'react';
import './StatsPanel.css';

const StatsPanel = ({ stats, loading }) => {
  // Formater le budget
  const formatBudget = (budget) => {
    if (!budget && budget !== 0) return '0 MGA';
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'MGA',
      maximumFractionDigits: 0
    }).format(budget);
  };

  // Formater la surface
  const formatSurface = (surface) => {
    if (!surface && surface !== 0) return '0 m²';
    return `${new Intl.NumberFormat('fr-FR').format(surface)} m²`;
  };

  if (loading) {
    return (
      <div className="stats-panel loading">
        <div className="loading-spinner small"></div>
        <span>Chargement des statistiques...</span>
      </div>
    );
  }

  return (
    <div className="stats-panel">
      <h3 className="stats-title">Récapitulatif</h3>
      
      <div className="stats-grid">
        <div className="stat-item">
          <span className="stat-icon">📍</span>
          <div className="stat-content">
            <span className="stat-value">{stats?.nb_signalements || 0}</span>
            <span className="stat-label">Signalements</span>
          </div>
        </div>

        <div className="stat-item">
          <span className="stat-icon">📐</span>
          <div className="stat-content">
            <span className="stat-value">{formatSurface(stats?.surface_totale)}</span>
            <span className="stat-label">Surface totale</span>
          </div>
        </div>

        <div className="stat-item">
          <span className="stat-icon">📊</span>
          <div className="stat-content">
            <span className="stat-value">{stats?.avancement_pourcentage || 0}%</span>
            <span className="stat-label">Avancement</span>
          </div>
          <div className="progress-bar">
            <div 
              className="progress-fill"
              style={{ width: `${stats?.avancement_pourcentage || 0}%` }}
            ></div>
          </div>
        </div>

        <div className="stat-item">
          <span className="stat-icon">💰</span>
          <div className="stat-content">
            <span className="stat-value">{formatBudget(stats?.budget_total)}</span>
            <span className="stat-label">Budget total</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatsPanel;
