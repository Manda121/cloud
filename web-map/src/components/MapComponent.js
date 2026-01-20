import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import config from '../config/config';
import './MapComponent.css';

// Fix pour les icônes Leaflet avec webpack
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

// Créer des icônes personnalisées selon le statut
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

// Composant pour recentrer la carte
const MapController = ({ center, zoom }) => {
  const map = useMap();
  
  useEffect(() => {
    if (center) {
      map.setView(center, zoom);
    }
  }, [center, zoom, map]);
  
  return null;
};

const MapComponent = ({ signalements = [], onMarkerClick }) => {
  const [hoveredSignalement, setHoveredSignalement] = useState(null);

  const getStatutInfo = (idStatut) => {
    return config.STATUTS[idStatut] || { label: 'Inconnu', color: '#9e9e9e' };
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('fr-FR');
  };

  const formatCurrency = (amount) => {
    if (!amount) return 'N/A';
    return new Intl.NumberFormat('fr-MG', {
      style: 'currency',
      currency: 'MGA',
      maximumFractionDigits: 0
    }).format(amount);
  };

  return (
    <div className="map-wrapper">
      <MapContainer
        center={config.MAP_CENTER}
        zoom={config.MAP_ZOOM}
        className="map-container"
      >
        <TileLayer
          attribution={config.TILE_ATTRIBUTION}
          url={config.TILE_SERVER_URL}
        />
        
        <MapController center={config.MAP_CENTER} zoom={config.MAP_ZOOM} />
        
        {signalements.map((signalement) => {
          const statutInfo = getStatutInfo(signalement.id_statut);
          
          return (
            <Marker
              key={signalement.id_signalement}
              position={[signalement.latitude, signalement.longitude]}
              icon={createCustomIcon(statutInfo.color)}
              eventHandlers={{
                mouseover: () => setHoveredSignalement(signalement),
                mouseout: () => setHoveredSignalement(null),
                click: () => onMarkerClick && onMarkerClick(signalement)
              }}
            >
              <Popup className="signalement-popup">
                <div className="popup-content">
                  <h3>{signalement.description}</h3>
                  <div className="popup-info">
                    <p>
                      <strong>Date:</strong> {formatDate(signalement.date_signalement)}
                    </p>
                    <p>
                      <strong>Statut:</strong>{' '}
                      <span 
                        className="status-badge"
                        style={{ backgroundColor: statutInfo.color }}
                      >
                        {statutInfo.label}
                      </span>
                    </p>
                    <p>
                      <strong>Surface:</strong> {signalement.surface_m2 || 'N/A'} m²
                    </p>
                    <p>
                      <strong>Budget:</strong> {formatCurrency(signalement.budget)}
                    </p>
                    <p>
                      <strong>Entreprise:</strong> {signalement.entreprise_nom || 'Non assignée'}
                    </p>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
      
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
