import React, { useState, useEffect } from 'react';
import MapComponent from '../components/MapComponent';
import StatsPanel from '../components/StatsPanel';
import signalementService from '../services/signalementService';
import './HomePage.css';

const HomePage = () => {
  const [signalements, setSignalements] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSignalement, setSelectedSignalement] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setStatsLoading(true);
      
      // Charger les signalements et les stats en parallèle
      const [signalementsData, statsData] = await Promise.all([
        signalementService.getAll().catch(() => []),
        signalementService.getStats().catch(() => null)
      ]);

      setSignalements(signalementsData);
      setStats(statsData);
      setError(null);
    } catch (err) {
      console.error('Erreur lors du chargement des données:', err);
      setError('Impossible de charger les données. Veuillez réessayer.');
    } finally {
      setLoading(false);
      setStatsLoading(false);
    }
  };

  const handleMarkerClick = (signalement) => {
    setSelectedSignalement(signalement);
  };

  const handleAddSignalement = async (signalementData) => {
    try {
      await signalementService.create(signalementData);
      // Recharger les données après ajout
      loadData();
    } catch (err) {
      console.error('Erreur lors de l\'ajout du signalement:', err);
      throw err;
    }
  };

  return (
    <div className="home-page">
      {/* Panneau des statistiques */}
      <StatsPanel stats={stats} loading={statsLoading} />

      {/* Zone de la carte */}
      <div className="map-wrapper">
        {loading ? (
          <div className="loading-overlay">
            <div className="loading-spinner"></div>
            <p>Chargement de la carte...</p>
          </div>
        ) : error ? (
          <div className="error-overlay">
            <p>{error}</p>
            <button onClick={loadData} className="btn-retry">
              Réessayer
            </button>
          </div>
        ) : (
          <MapComponent
            signalements={signalements}
            onMarkerClick={handleMarkerClick}
            selectedSignalement={selectedSignalement}
            onAddSignalement={handleAddSignalement}
          />
        )}
      </div>

      {/* Message d'information pour les visiteurs */}
      <div className="visitor-info">
        <span>👁️ Mode visiteur</span>
        <span>|</span>
        <span>Survolez les marqueurs pour voir les détails • Cliquez sur la carte pour ajouter un signalement</span>
      </div>
    </div>
  );
};

export default HomePage;
