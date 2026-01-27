import React, { useState, useEffect } from 'react';
import signalementService from '../services/signalementService';
import { useAuth } from '../context/AuthContext';
import './ManageUsersPage.css';

const ManageUsersPage = () => {
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [unblocking, setUnblocking] = useState(null);
  const { unblock } = useAuth();

  useEffect(() => {
    loadBlockedUsers();
  }, []);

  const loadBlockedUsers = async () => {
    try {
      setLoading(true);
      const users = await signalementService.getBlockedUsers();
      setBlockedUsers(users);
    } catch (err) {
      console.error('Erreur:', err);
      // S'il n'y a pas d'API pour récupérer les utilisateurs bloqués,
      // on affiche un message
      setBlockedUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleUnblock = async (email) => {
    try {
      setUnblocking(email);
      const result = await unblock(email);
      
      if (result.success) {
        setMessage({ type: 'success', text: `L'utilisateur ${email} a été débloqué` });
        // Retirer l'utilisateur de la liste
        setBlockedUsers(blockedUsers.filter(u => u.email !== email));
      } else {
        setMessage({ type: 'error', text: result.error });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Erreur lors du déblocage' });
    } finally {
      setUnblocking(null);
    }
  };

  // Débloquer manuellement avec un email
  const [manualEmail, setManualEmail] = useState('');

  const handleManualUnblock = async (e) => {
    e.preventDefault();
    if (!manualEmail.trim()) return;
    
    await handleUnblock(manualEmail);
    setManualEmail('');
  };

  if (loading) {
    return (
      <div className="page-loading">
        <div className="loading-spinner"></div>
        <p>Chargement des utilisateurs...</p>
      </div>
    );
  }

  return (
    <div className="manage-users-page">
      <div className="page-header">
        <h1>Gestion des utilisateurs</h1>
        <p>Débloquer les comptes bloqués suite à plusieurs tentatives échouées</p>
      </div>

      {message && (
        <div className={`message ${message.type}`}>
          {message.text}
          <button onClick={() => setMessage(null)}>×</button>
        </div>
      )}

      {/* Formulaire de déblocage manuel */}
      <div className="manual-unblock-section">
        <h2>Débloquer un compte</h2>
        <form onSubmit={handleManualUnblock} className="manual-unblock-form">
          <input
            type="email"
            value={manualEmail}
            onChange={(e) => setManualEmail(e.target.value)}
            placeholder="Entrez l'email de l'utilisateur à débloquer"
            required
          />
          <button type="submit" disabled={unblocking === manualEmail}>
            {unblocking === manualEmail ? 'Déblocage...' : 'Débloquer'}
          </button>
        </form>
      </div>

      {/* Liste des utilisateurs bloqués */}
      <div className="blocked-users-section">
        <h2>Utilisateurs bloqués ({blockedUsers.length})</h2>
        
        {blockedUsers.length > 0 ? (
          <div className="users-list">
            {blockedUsers.map((user) => (
              <div key={user.id_user || user.email} className="user-card">
                <div className="user-info">
                  <span className="user-avatar">👤</span>
                  <div className="user-details">
                    <span className="user-name">
                      {user.firstname} {user.lastname}
                    </span>
                    <span className="user-email">{user.email}</span>
                    <span className="user-attempts">
                      {user.attempts} tentatives échouées
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handleUnblock(user.email)}
                  className="btn-unblock"
                  disabled={unblocking === user.email}
                >
                  {unblocking === user.email ? '⏳' : '🔓'} Débloquer
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="no-blocked-users">
            <span className="no-data-icon">✅</span>
            <p>Aucun utilisateur bloqué</p>
            <span className="no-data-desc">
              Tous les comptes sont actifs
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default ManageUsersPage;
