import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
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

const MapComponent = ({ signalements = [], onMarkerClick, selectedSignalement }) => {
  const mapRef = useRef(null);

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
