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
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [signalementsData, entreprisesData] = await Promise.all([
        signalementService.getAll(),
        signalementService.getEntreprises()
      ]);
      setSignalements(signalementsData);
      setEntreprises(entreprisesData);
    } catch (err) {
      setMessage({ type: 'error', text: 'Erreur lors du chargement des données' });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (signalement) => {
    setEditingId(signalement.id_signalement);
    setEditForm({
      surface_m2: signalement.surface_m2 || '',
      budget: signalement.budget || '',
      id_statut: signalement.id_statut || 1,
      entreprise_nom: signalement.entreprise_nom || ''
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setEditForm({
      ...editForm,
      [name]: value
    });
  };

  const handleSave = async (id) => {
    try {
      setMessage({ type: '', text: '' });
      
      await signalementService.update(id, {
        surface_m2: parseFloat(editForm.surface_m2) || null,
        budget: parseFloat(editForm.budget) || null,
        id_statut: parseInt(editForm.id_statut),
        entreprise_nom: editForm.entreprise_nom
      });
      
      // Recharger les données
      await loadData();
      setEditingId(null);
      setMessage({ type: 'success', text: 'Signalement mis à jour avec succès' });
    } catch (err) {
      setMessage({ type: 'error', text: 'Erreur lors de la mise à jour' });
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('fr-FR');
  };

  const formatCurrency = (amount) => {
    if (!amount) return '-';
    return new Intl.NumberFormat('fr-MG').format(amount) + ' MGA';
  };

  const getStatutInfo = (idStatut) => {
    return config.STATUTS[idStatut] || { label: 'Inconnu', color: '#9e9e9e' };
  };

  if (loading) {
    return (
      <div className="signalements-page">
        <div className="container">
          <div className="loader">
            <div className="spinner"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="signalements-page">
      <div className="container">
        <h1 className="page-title">Gestion des signalements</h1>
        
        {message.text && (
          <div className={`${message.type}-message`}>
            {message.text}
          </div>
        )}
        
        <div className="card table-container">
          <table className="table signalements-table">
            <thead>
              <tr>
                <th>Description</th>
                <th>Date</th>
                <th>Statut</th>
                <th>Surface (m²)</th>
                <th>Budget</th>
                <th>Entreprise</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {signalements.map((signalement) => {
                const isEditing = editingId === signalement.id_signalement;
                const statutInfo = getStatutInfo(signalement.id_statut);
                
                return (
                  <tr key={signalement.id_signalement}>
                    <td className="description-cell">
                      {signalement.description}
                    </td>
                    <td>{formatDate(signalement.date_signalement)}</td>
                    <td>
                      {isEditing ? (
                        <select
                          name="id_statut"
                          value={editForm.id_statut}
                          onChange={handleFormChange}
                          className="form-select-sm"
                        >
                          {Object.entries(config.STATUTS).map(([id, statut]) => (
                            <option key={id} value={id}>{statut.label}</option>
                          ))}
                        </select>
                      ) : (
                        <span 
                          className="status-badge"
                          style={{ backgroundColor: statutInfo.color }}
                        >
                          {statutInfo.label}
                        </span>
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <input
                          type="number"
                          name="surface_m2"
                          value={editForm.surface_m2}
                          onChange={handleFormChange}
                          className="form-input-sm"
                          step="0.1"
                        />
                      ) : (
                        signalement.surface_m2 || '-'
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <input
                          type="number"
                          name="budget"
                          value={editForm.budget}
                          onChange={handleFormChange}
                          className="form-input-sm"
                        />
                      ) : (
                        formatCurrency(signalement.budget)
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <select
                          name="entreprise_nom"
                          value={editForm.entreprise_nom}
                          onChange={handleFormChange}
                          className="form-select-sm"
                        >
                          <option value="">Non assignée</option>
                          {entreprises.map((e) => (
                            <option key={e.id_entreprise} value={e.nom}>
                              {e.nom}
                            </option>
                          ))}
                        </select>
                      ) : (
                        signalement.entreprise_nom || '-'
                      )}
                    </td>
                    <td className="actions-cell">
                      {isEditing ? (
                        <>
                          <button
                            className="btn btn-success btn-sm"
                            onClick={() => handleSave(signalement.id_signalement)}
                          >
                            ✓
                          </button>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={handleCancelEdit}
                          >
                            ✕
                          </button>
                        </>
                      ) : (
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => handleEdit(signalement)}
                        >
                          ✏️ Modifier
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ManageSignalementsPage;
