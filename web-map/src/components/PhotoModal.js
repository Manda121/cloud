import React, { useState, useEffect } from 'react';
import firestoreService from '../services/firestoreService';

const overlayStyle = {
  position: 'fixed',
  top: 0, left: 0, right: 0, bottom: 0,
  background: 'rgba(0,0,0,0.7)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 10000,
};

const modalStyle = {
  background: '#fff',
  borderRadius: '12px',
  padding: '24px',
  maxWidth: '700px',
  width: '90%',
  maxHeight: '80vh',
  overflow: 'auto',
  position: 'relative',
};

const closeBtn = {
  position: 'absolute',
  top: '10px',
  right: '14px',
  background: 'none',
  border: 'none',
  fontSize: '24px',
  cursor: 'pointer',
  color: '#666',
};

const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
  gap: '12px',
  marginTop: '16px',
};

const imgStyle = {
  width: '100%',
  borderRadius: '8px',
  cursor: 'pointer',
  boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
};

const fullImgOverlay = {
  position: 'fixed',
  top: 0, left: 0, right: 0, bottom: 0,
  background: 'rgba(0,0,0,0.9)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 10001,
  cursor: 'zoom-out',
};

const PhotoModal = ({ firestoreId, description, onClose }) => {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fullView, setFullView] = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const result = await firestoreService.getPhotos(firestoreId);
      setPhotos(result);
      setLoading(false);
    };
    if (firestoreId) load();
    else setLoading(false);
  }, [firestoreId]);

  // Fermer avec Escape
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') {
        if (fullView) setFullView(null);
        else onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [fullView, onClose]);

  return (
    <>
      <div style={overlayStyle} onClick={onClose}>
        <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
          <button style={closeBtn} onClick={onClose}>✕</button>
          <h2 style={{ marginTop: 0 }}>📷 Photos du signalement</h2>
          {description && (
            <p style={{ color: '#666', margin: '4px 0 12px' }}>{description}</p>
          )}

          {loading ? (
            <p style={{ textAlign: 'center', padding: '30px', color: '#999' }}>
              ⏳ Chargement des photos...
            </p>
          ) : photos.length === 0 ? (
            <p style={{ textAlign: 'center', padding: '30px', color: '#999' }}>
              Aucune photo disponible pour ce signalement.
              <br />
              <small>Les photos sont stockées localement sur l'appareil mobile.</small>
            </p>
          ) : (
            <div style={gridStyle}>
              {photos.map((src, idx) => (
                <div key={idx}>
                  <img
                    src={src}
                    alt={`Photo ${idx + 1}`}
                    style={imgStyle}
                    onClick={() => setFullView(src)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Plein écran */}
      {fullView && (
        <div style={fullImgOverlay} onClick={() => setFullView(null)}>
          <img
            src={fullView}
            alt="Photo plein écran"
            style={{ maxWidth: '95%', maxHeight: '95%', borderRadius: '8px' }}
          />
        </div>
      )}
    </>
  );
};

export default PhotoModal;
