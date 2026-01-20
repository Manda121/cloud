import React, { useState, useEffect } from 'react';
import MapComponent from '../components/MapComponent';
import StatsPanel from '../components/StatsPanel';
import signalementService from '../services/signalementService';
import './HomePage.css';

const HomePage = () => {
  const [signalements, setSignalements] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [signalementsData, statsData] = await Promise.all([
        signalementService.getAll(),
        signalementService.getStats()
      ]);
      setSignalements(signalementsData);
      setStats(statsData);
    } catch (err) {
      setError('Erreur lors du chargement des données');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkerClick = (signalement) => {
    console.log('Signalement cliqué:', signalement);
  };

  if (loading) {
    return (
      <div className="home-page">
        <div className="loader">
          <div className="spinner"></div>
          <p>Chargement de la carte...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="home-page">
      {error && <div className="error-message">{error}</div>}
      
      <div className="home-content">
        <div className="map-section">
          <MapComponent 
            signalements={signalements} 
            onMarkerClick={handleMarkerClick}
          />
        </div>
        
        <div className="stats-section">
          <StatsPanel stats={stats} />
        </div>
      </div>
    </div>
  );
};

export default HomePage;
