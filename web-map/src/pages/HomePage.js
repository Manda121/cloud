import React, { useState, useEffect, useCallback } from 'react';
import MapComponent from '../components/MapComponent';
import StatsPanel from '../components/StatsPanel';
import signalementService from '../services/signalementService';
import { useAuth } from '../context/AuthContext';
import './HomePage.css';

const HomePage = () => {
  const { user, isAuthenticated } = useAuth();
  const [signalements, setSignalements] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSignalement, setSelectedSignalement] = useState(null);
  const [showMyOnly, setShowMyOnly] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setStatsLoading(true);
      
      // Charger les signalements (filtrés ou non) et les stats en parallèle
      const signalementsPromise = (showMyOnly && isAuthenticated && user?.id)
        ? signalementService.getByUser(user.id).catch(() => [])
        : signalementService.getAll().catch(() => []);

      const [signalementsData, statsData] = await Promise.all([
        signalementsPromise,
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
  }, [showMyOnly, isAuthenticated, user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleMarkerClick = (signalement) => {
    setSelectedSignalement(signalement);
  };

  const handleAddSignalement = async (signalementData) => {
    try {
      // Associer le signalement à l'utilisateur connecté si possible
      if (isAuthenticated && user?.id) {
        signalementData.id_user = user.id;
      }
      await signalementService.create(signalementData);
      // Recharger les données après ajout
      loadData();
    } catch (err) {
      console.error('Erreur lors de l\'ajout du signalement:', err);
      throw err;
    }
  };

  const toggleMySignalements = () => {
    setShowMyOnly(prev => !prev);
  };

  return (
    <div className="home-page">
      {/* Panneau des statistiques */}
      <StatsPanel stats={stats} loading={statsLoading} />

      {/* Barre de filtres */}
      {isAuthenticated && (
        <div className="filter-bar">
          <button
            className={`btn-filter ${showMyOnly ? 'active' : ''}`}
            onClick={toggleMySignalements}
          >
            {showMyOnly ? '📌 Mes signalements' : '🗺️ Tous les signalements'}
          </button>
          {showMyOnly && (
            <span className="filter-count">
              {signalements.length} signalement{signalements.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}

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
            showMyOnly={showMyOnly}
            onToggleFilter={toggleMySignalements}
            isAuthenticated={isAuthenticated}
          />
        )}
      </div>

      {/* Message d'information */}
      <div className="visitor-info">
        {isAuthenticated ? (
          <>
            <span>👤 {user?.firstname || user?.email}</span>
            <span>|</span>
            <span>{showMyOnly ? 'Affichage de vos signalements uniquement' : 'Affichage de tous les signalements'}</span>
          </>
        ) : (
          <>
            <span>👁️ Mode visiteur</span>
            <span>|</span>
            <span>Connectez-vous pour filtrer vos signalements</span>
          </>
        )}
      </div>
    </div>
  );
};

export default HomePage;
