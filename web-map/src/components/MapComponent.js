import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import config from '../config/config';
import './MapComponent.css';

// Fix pour les icônes de Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Icônes personnalisées par statut
const createCustomIcon = (color) => {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      background-color: ${color};
      width: 24px;
      height: 24px;
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 2px 5px rgba(0,0,0,0.3);
    "></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12]
  });
};

// Composant pour recadrer la carte
const MapRecenter = ({ center, zoom }) => {
  const map = useMap();
  
  useEffect(() => {
    if (center) {
      map.setView(center, zoom);
    }
  }, [center, zoom, map]);

  return null;
};

// Composant pour gérer les clics sur la carte
const MapClickHandler = ({ onMapClick }) => {
  useMapEvents({
    click: (e) => {
      if (onMapClick) {
        onMapClick(e.latlng);
      }
    }
  });
  return null;
};

const MapComponent = ({ signalements = [], onMarkerClick, selectedSignalement, onAddSignalement, showMyOnly, onToggleFilter, isAuthenticated }) => {
  const mapRef = useRef(null);
  const [clickedPosition, setClickedPosition] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSignalement, setNewSignalement] = useState({
    description: '',
    surface_m2: '',
    budget: ''
  });

  // Formater la date
  const formatDate = (dateString) => {
    if (!dateString) return 'Non définie';
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  // Formater le budget
  const formatBudget = (budget) => {
    if (!budget) return 'Non défini';
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'MGA',
      maximumFractionDigits: 0
    }).format(budget);
  };

  // Obtenir les coordonnées d'un signalement
  const getCoordinates = (signalement) => {
    if (signalement.geom) {
      // Format GeoJSON
      if (signalement.geom.coordinates) {
        return [signalement.geom.coordinates[1], signalement.geom.coordinates[0]];
      }
    }
    if (signalement.latitude && signalement.longitude) {
      return [signalement.latitude, signalement.longitude];
    }
    return null;
  };

  // Gérer le clic sur la carte
  const handleMapClick = (latlng) => {
    setClickedPosition(latlng);
    setShowAddForm(true);
    setNewSignalement({
      description: '',
      surface_m2: '',
      budget: ''
    });
  };

  // Soumettre le nouveau signalement
  const handleSubmitSignalement = async (e) => {
    e.preventDefault();
    if (!clickedPosition || !onAddSignalement) return;

    const signalementData = {
      description: newSignalement.description,
      surface_m2: parseFloat(newSignalement.surface_m2) || 0,
      budget: parseFloat(newSignalement.budget) || 0,
      geom: {
        coordinates: [clickedPosition.lng, clickedPosition.lat]
      }
    };

    try {
      await onAddSignalement(signalementData);
      setShowAddForm(false);
      setClickedPosition(null);
      setNewSignalement({ description: '', surface_m2: '', budget: '' });
    } catch (error) {
      console.error('Erreur ajout signalement:', error);
    }
  };

  // Annuler l'ajout
  const handleCancelAdd = () => {
    setShowAddForm(false);
    setClickedPosition(null);
  };

  return (
    <div className="map-container">
      <MapContainer
        center={config.DEFAULT_CENTER}
        zoom={config.DEFAULT_ZOOM}
        ref={mapRef}
        className="leaflet-map"
      >
        <TileLayer
          url={config.TILE_SERVER_URL}
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />

        <MapClickHandler onMapClick={handleMapClick} />

        {selectedSignalement && getCoordinates(selectedSignalement) && (
          <MapRecenter 
            center={getCoordinates(selectedSignalement)} 
            zoom={16} 
          />
        )}

        {signalements.map((signalement) => {
          const coords = getCoordinates(signalement);
          if (!coords) return null;

          const statut = config.STATUTS[signalement.id_statut] || config.STATUTS[1];
          const icon = createCustomIcon(statut.color);

          return (
            <Marker
              key={signalement.id_signalement}
              position={coords}
              icon={icon}
              eventHandlers={{
                click: () => onMarkerClick && onMarkerClick(signalement)
              }}
            >
              <Tooltip 
                direction="top" 
                offset={[0, -10]} 
                opacity={0.95}
                className="signalement-tooltip"
              >
                <div className="tooltip-content">
                  <strong>{statut.label}</strong>
                  <br />
                  {signalement.surface_m2 && <span>{signalement.surface_m2} m²</span>}
                  {signalement.budget && <span> • {formatBudget(signalement.budget)}</span>}
                  <br />
                  <small>{signalement.description?.substring(0, 50)}...</small>
                </div>
              </Tooltip>
              <Popup className="custom-popup">
                <div className="popup-content">
                  <h3 className="popup-title">Signalement</h3>
                  
                  <div className="popup-info">
                    <span className="popup-label">Date:</span>
                    <span className="popup-value">{formatDate(signalement.date_signalement)}</span>
                  </div>
                  
                  <div className="popup-info">
                    <span className="popup-label">Statut:</span>
                    <span 
                      className="popup-status"
                      style={{ backgroundColor: statut.color }}
                    >
                      {statut.label}
                    </span>
                  </div>
                  
                  <div className="popup-info">
                    <span className="popup-label">Surface:</span>
                    <span className="popup-value">
                      {signalement.surface_m2 ? `${signalement.surface_m2} m²` : 'Non définie'}
                    </span>
                  </div>
                  
                  <div className="popup-info">
                    <span className="popup-label">Budget:</span>
                    <span className="popup-value">{formatBudget(signalement.budget)}</span>
                  </div>
                  
                  <div className="popup-info">
                    <span className="popup-label">Entreprise:</span>
                    <span className="popup-value">
                      {signalement.entreprise_nom || 'Non assignée'}
                    </span>
                  </div>
                  
                  {signalement.description && (
                    <div className="popup-description">
                      <span className="popup-label">Description:</span>
                      <p>{signalement.description}</p>
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Marqueur temporaire pour l'ajout */}
        {clickedPosition && (
          <Marker
            position={[clickedPosition.lat, clickedPosition.lng]}
            icon={createCustomIcon('#9b59b6')}
          >
            <Popup>
              <div className="popup-content">
                <strong>Nouvel emplacement</strong>
                <p>Cliquez sur le formulaire pour ajouter un signalement</p>
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>

      {/* Formulaire d'ajout de signalement */}
      {showAddForm && clickedPosition && (
        <div className="add-signalement-modal">
          <div className="add-signalement-form">
            <h3>Ajouter un signalement</h3>
            <p className="location-info">
              Position: {clickedPosition.lat.toFixed(5)}, {clickedPosition.lng.toFixed(5)}
            </p>
            <form onSubmit={handleSubmitSignalement}>
              <div className="form-group">
                <label>Description *</label>
                <textarea
                  value={newSignalement.description}
                  onChange={(e) => setNewSignalement({...newSignalement, description: e.target.value})}
                  placeholder="Décrivez le problème..."
                  required
                  rows={3}
                />
              </div>
              <div className="form-group">
                <label>Surface (m²)</label>
                <input
                  type="number"
                  value={newSignalement.surface_m2}
                  onChange={(e) => setNewSignalement({...newSignalement, surface_m2: e.target.value})}
                  placeholder="ex: 150"
                  min="0"
                />
              </div>
              <div className="form-group">
                <label>Budget estimé (MGA)</label>
                <input
                  type="number"
                  value={newSignalement.budget}
                  onChange={(e) => setNewSignalement({...newSignalement, budget: e.target.value})}
                  placeholder="ex: 5000000"
                  min="0"
                />
              </div>
              <div className="form-actions">
                <button type="button" className="btn-cancel" onClick={handleCancelAdd}>
                  Annuler
                </button>
                <button type="submit" className="btn-submit">
                  Ajouter
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Compteur de signalements */}
      <div className="map-counter">
        📍 {signalements.length} signalement{signalements.length !== 1 ? 's' : ''}
        {showMyOnly && <span className="map-counter-filter"> (mes signalements)</span>}
      </div>

      {/* Filtre utilisateur */}
      {isAuthenticated && onToggleFilter && (
        <div className="map-filter-control">
          <button
            className={`map-filter-btn ${showMyOnly ? 'active' : ''}`}
            onClick={onToggleFilter}
            title={showMyOnly ? 'Voir tous les signalements' : 'Voir mes signalements'}
          >
            {showMyOnly ? '👤 Mes signalements' : '🗺️ Tous'}
          </button>
        </div>
      )}

      {/* Légende */}
      <div className="map-legend">
        <h4>Légende</h4>
        {Object.entries(config.STATUTS).map(([id, statut]) => (
          <div key={id} className="legend-item">
            <span 
              className="legend-color" 
              style={{ backgroundColor: statut.color }}
            ></span>
            <span>{statut.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MapComponent;
