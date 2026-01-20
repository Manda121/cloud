import React, { useState, useEffect } from 'react';
import signalementService from '../services/signalementService';
import authService from '../services/authService';
import './ManageUsersPage.css';

const ManageUsersPage = () => {
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    loadBlockedUsers();
  }, []);

  const loadBlockedUsers = async () => {
    try {
      setLoading(true);
      const users = await signalementService.getBlockedUsers();
      setBlockedUsers(users);
    } catch (err) {
      setMessage({ type: 'error', text: 'Erreur lors du chargement des utilisateurs' });
    } finally {
      setLoading(false);
    }
  };

  const handleUnblock = async (email) => {
    try {
      setActionLoading(email);
      setMessage({ type: '', text: '' });
      
      await authService.unblockUser(email);
      
      // Retirer l'utilisateur de la liste
      setBlockedUsers(blockedUsers.filter(u => u.email !== email));
      setMessage({ type: 'success', text: `Utilisateur ${email} débloqué avec succès` });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Erreur lors du déblocage' });
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="users-page">
        <div className="container">
          <div className="loader">
            <div className="spinner"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="users-page">
      <div className="container">
        <h1 className="page-title">Gestion des utilisateurs bloqués</h1>
        
        {message.text && (
          <div className={`${message.type}-message`}>
            {message.text}
          </div>
        )}
        
        {blockedUsers.length === 0 ? (
          <div className="card empty-state">
            <span className="empty-icon">✅</span>
            <h3>Aucun utilisateur bloqué</h3>
            <p>Tous les utilisateurs peuvent accéder à leur compte normalement.</p>
          </div>
        ) : (
          <div className="card">
            <table className="table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Prénom</th>
                  <th>Nom</th>
                  <th>Tentatives</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {blockedUsers.map((user) => (
                  <tr key={user.id_user}>
                    <td>{user.email}</td>
                    <td>{user.firstname || '-'}</td>
                    <td>{user.lastname || '-'}</td>
                    <td>
                      <span className="attempts-badge">{user.attempts}</span>
                    </td>
                    <td>
                      <button
                        className="btn btn-success btn-sm"
                        onClick={() => handleUnblock(user.email)}
                        disabled={actionLoading === user.email}
                      >
                        {actionLoading === user.email ? 'Déblocage...' : 'Débloquer'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        <div className="info-card card">
          <h3>ℹ️ Informations</h3>
          <p>
            Un utilisateur est automatiquement bloqué après plusieurs tentatives 
            de connexion échouées. Le déblocage remet le compteur de tentatives à zéro 
            et permet à l'utilisateur de se reconnecter.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ManageUsersPage;
