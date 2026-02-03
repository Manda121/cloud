import React, { useState, useEffect } from 'react';
import signalementService from '../services/signalementService';
import config from '../config/config';
import './ManageSignalementsPage.css';

const ManageSignalementsPage = () => {
  const [signalements, setSignalements] = useState([]);
  const [entreprises, setEntreprises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [message, setMessage] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [sigData, entData] = await Promise.all([
        signalementService.getAll(),
        signalementService.getEntreprises().catch(() => [])
      ]);
      setSignalements(sigData);
      setEntreprises(entData);
    } catch (err) {
      console.error('Erreur:', err);
      setMessage({ type: 'error', text: 'Erreur lors du chargement des données' });
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (signalement) => {
    setEditingId(signalement.id_signalement);
    setEditForm({
      id_statut: signalement.id_statut || 1,
      surface_m2: signalement.surface_m2 || '',
      budget: signalement.budget || '',
      id_entreprise: signalement.id_entreprise || '',
      description: signalement.description || ''
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleFormChange = (e) => {
    setEditForm({
      ...editForm,
      [e.target.name]: e.target.value
    });
  };

  const saveEdit = async (id) => {
    try {
      await signalementService.update(id, editForm);
      setMessage({ type: 'success', text: 'Signalement mis à jour avec succès' });
      setEditingId(null);
      loadData();
    } catch (err) {
      setMessage({ type: 'error', text: 'Erreur lors de la mise à jour' });
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('fr-FR');
  };

  const formatBudget = (budget) => {
    if (!budget) return '-';
    return new Intl.NumberFormat('fr-FR').format(budget) + ' MGA';
  };

  if (loading) {
    return (
      <div className="page-loading">
        <div className="loading-spinner"></div>
        <p>Chargement des signalements...</p>
      </div>
    );
  }

  return (
    <div className="manage-signalements-page">
      <div className="page-header">
        <h1>Gestion des signalements</h1>
        <p>{signalements.length} signalement(s) au total</p>
      </div>

      {message && (
        <div className={`message ${message.type}`}>
          {message.text}
          <button onClick={() => setMessage(null)}>×</button>
        </div>
      )}

      <div className="signalements-table-container">
        <table className="signalements-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Statut</th>
              <th>Surface (m²)</th>
              <th>Budget</th>
              <th>Entreprise</th>
              <th>Description</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {signalements.map((sig) => (
              <tr key={sig.id_signalement}>
                {editingId === sig.id_signalement ? (
                  // Mode édition
                  <>
                    <td>{formatDate(sig.date_signalement)}</td>
                    <td>
                      <select
                        name="id_statut"
                        value={editForm.id_statut}
                        onChange={handleFormChange}
                        className="edit-select"
                      >
                        {Object.entries(config.STATUTS).map(([id, statut]) => (
                          <option key={id} value={id}>{statut.label}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        type="number"
                        name="surface_m2"
                        value={editForm.surface_m2}
                        onChange={handleFormChange}
                        className="edit-input"
                        placeholder="Surface"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        name="budget"
                        value={editForm.budget}
                        onChange={handleFormChange}
                        className="edit-input"
                        placeholder="Budget"
                      />
                    </td>
                    <td>
                      <select
                        name="id_entreprise"
                        value={editForm.id_entreprise}
                        onChange={handleFormChange}
                        className="edit-select"
                      >
                        <option value="">Non assignée</option>
                        {entreprises.map((ent) => (
                          <option key={ent.id_entreprise} value={ent.id_entreprise}>
                            {ent.nom}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        type="text"
                        name="description"
                        value={editForm.description}
                        onChange={handleFormChange}
                        className="edit-input"
                        placeholder="Description"
                      />
                    </td>
                    <td className="actions-cell">
                      <button 
                        onClick={() => saveEdit(sig.id_signalement)}
                        className="btn-save"
                      >
                        ✓
                      </button>
                      <button 
                        onClick={cancelEdit}
                        className="btn-cancel"
                      >
                        ✕
                      </button>
                    </td>
                  </>
                ) : (
                  // Mode affichage
                  <>
                    <td>{formatDate(sig.date_signalement)}</td>
                    <td>
                      <span 
                        className="status-badge"
                        style={{ 
                          backgroundColor: config.STATUTS[sig.id_statut]?.color || '#999' 
                        }}
                      >
                        {config.STATUTS[sig.id_statut]?.label || 'Inconnu'}
                      </span>
                    </td>
                    <td>{sig.surface_m2 ? `${sig.surface_m2} m²` : '-'}</td>
                    <td>{formatBudget(sig.budget)}</td>
                    <td>{sig.entreprise_nom || '-'}</td>
                    <td className="description-cell">
                      {sig.description || '-'}
                    </td>
                    <td className="actions-cell">
                      <button 
                        onClick={() => startEdit(sig)}
                        className="btn-edit"
                      >
                        ✏️ Modifier
                      </button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        {signalements.length === 0 && (
          <div className="no-data">
            Aucun signalement trouvé
          </div>
        )}
      </div>
    </div>
  );
};

export default ManageSignalementsPage;
