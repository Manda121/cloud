import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './ManageSignalementsPage.css';

const ConfigPrixPage = () => {
  const [prix, setPrix] = useState(0);
  const [newPrix, setNewPrix] = useState('');
  const [montants, setMontants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [prixRes, montantsRes] = await Promise.all([
        axios.get('/api/config/prix'),
        axios.get('/api/config/montants')
      ]);
      setPrix(prixRes.data.prix);
      setNewPrix(String(prixRes.data.prix));
      setMontants(montantsRes.data.signalements || []);
    } catch (err) {
      console.error('Erreur chargement config:', err);
      setMessage({ type: 'error', text: 'Erreur lors du chargement' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    const val = parseInt(newPrix, 10);
    if (isNaN(val) || val < 0) {
      setMessage({ type: 'error', text: 'Veuillez entrer un nombre valide' });
      return;
    }
    try {
      setSaving(true);
      await axios.put('/api/config/prix', { prix: val });
      setPrix(val);
      setMessage({ type: 'success', text: `Prix unitaire mis à jour : ${formatMGA(val)} /m²` });
      // Recharger les montants avec le nouveau prix
      const montantsRes = await axios.get('/api/config/montants');
      setMontants(montantsRes.data.signalements || []);
    } catch (err) {
      setMessage({ type: 'error', text: 'Erreur lors de la sauvegarde' });
    } finally {
      setSaving(false);
    }
  };

  const formatMGA = (value) => {
    if (value === null || value === undefined) return '-';
    return new Intl.NumberFormat('fr-FR').format(value) + ' MGA';
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('fr-FR');
  };

  const totalMontant = montants.reduce((sum, m) => sum + (m.montant || 0), 0);

  if (loading) {
    return (
      <div className="page-loading">
        <div className="loading-spinner"></div>
        <p>Chargement...</p>
      </div>
    );
  }

  return (
    <div className="manage-signalements-page">
      <div className="page-header">
        <h1>💲 Configuration du prix unitaire</h1>
        <p>Le montant de chaque signalement = prix unitaire × surface (m²)</p>
      </div>

      {message && (
        <div className={`message ${message.type}`}>
          {message.text}
          <button onClick={() => setMessage(null)}>×</button>
        </div>
      )}

      {/* Section prix unitaire */}
      <div style={{
        background: '#fff',
        borderRadius: '12px',
        padding: '24px',
        marginBottom: '24px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
      }}>
        <h2 style={{ marginTop: 0 }}>Prix unitaire actuel : <span style={{ color: '#2196F3' }}>{formatMGA(prix)} /m²</span></h2>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '16px' }}>
          <input
            type="number"
            value={newPrix}
            onChange={(e) => setNewPrix(e.target.value)}
            placeholder="Nouveau prix en MGA"
            min="0"
            style={{
              padding: '10px 14px',
              borderRadius: '8px',
              border: '1px solid #ddd',
              fontSize: '16px',
              width: '250px'
            }}
          />
          <span style={{ color: '#666' }}>MGA / m²</span>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '10px 24px',
              borderRadius: '8px',
              background: saving ? '#ccc' : '#4CAF50',
              color: '#fff',
              border: 'none',
              cursor: saving ? 'default' : 'pointer',
              fontSize: '14px',
              fontWeight: 'bold'
            }}
          >
            {saving ? '⏳ Sauvegarde...' : '✓ Enregistrer'}
          </button>
        </div>
      </div>

      {/* Tableau des montants */}
      <div style={{
        background: '#fff',
        borderRadius: '12px',
        padding: '24px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
      }}>
        <h2 style={{ marginTop: 0 }}>
          Montants calculés 
          <span style={{ fontSize: '14px', color: '#666', marginLeft: '12px' }}>
            ({montants.length} signalements)
          </span>
        </h2>
        <div style={{
          background: '#E3F2FD',
          padding: '12px 20px',
          borderRadius: '8px',
          marginBottom: '16px',
          fontSize: '18px',
          fontWeight: 'bold'
        }}>
          Montant total : {formatMGA(totalMontant)}
        </div>

        <div className="signalements-table-container">
          <table className="signalements-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Surface (m²)</th>
                <th>Prix unitaire</th>
                <th>Montant total</th>
              </tr>
            </thead>
            <tbody>
              {montants.map((m) => (
                <tr key={m.id_signalement}>
                  <td>{formatDate(m.date_signalement)}</td>
                  <td className="description-cell">{m.description || '-'}</td>
                  <td>{m.surface_m2} m²</td>
                  <td>{formatMGA(m.prix_unitaire)}</td>
                  <td style={{ fontWeight: 'bold', color: '#2196F3' }}>
                    {formatMGA(m.montant)}
                  </td>
                </tr>
              ))}
              {montants.length === 0 && (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
                    Aucun signalement avec surface renseignée
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ConfigPrixPage;
