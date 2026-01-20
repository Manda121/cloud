import React from 'react';
import config from '../config/config';
import './StatsPanel.css';

const StatsPanel = ({ stats }) => {
  const formatCurrency = (amount) => {
    if (!amount) return '0 MGA';
    return new Intl.NumberFormat('fr-MG', {
      style: 'currency',
      currency: 'MGA',
      maximumFractionDigits: 0
    }).format(amount);
  };

  return (
    <div className="stats-panel">
      <h3>Récapitulation</h3>
      
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">📍</div>
          <div className="stat-content">
            <span className="stat-value">{stats?.totalPoints || 0}</span>
            <span className="stat-label">Points signalés</span>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">📐</div>
          <div className="stat-content">
            <span className="stat-value">{stats?.totalSurface?.toFixed(1) || 0} m²</span>
            <span className="stat-label">Surface totale</span>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">📊</div>
          <div className="stat-content">
            <span className="stat-value">{stats?.avancement || 0}%</span>
            <span className="stat-label">Avancement</span>
          </div>
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${stats?.avancement || 0}%` }}
            ></div>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">💰</div>
          <div className="stat-content">
            <span className="stat-value">{formatCurrency(stats?.totalBudget)}</span>
            <span className="stat-label">Budget total</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatsPanel;
