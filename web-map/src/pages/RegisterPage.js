import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './AuthPages.css';

const RegisterPage = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstname: '',
    lastname: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validation
    if (formData.password !== formData.confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }

    if (formData.password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    setLoading(true);

    try {
      await register(
        formData.email,
        formData.password,
        formData.firstname,
        formData.lastname
      );
      setSuccess('Compte créé avec succès ! Vous pouvez maintenant vous connecter.');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors de l\'inscription');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h2>Créer un compte Manager</h2>
        <p className="auth-subtitle">Inscrivez-vous pour gérer les travaux routiers</p>
        
        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}
        
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="firstname">Prénom</label>
              <input
                type="text"
                id="firstname"
                name="firstname"
                value={formData.firstname}
                onChange={handleChange}
                placeholder="Jean"
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="lastname">Nom</label>
              <input
                type="text"
                id="lastname"
                name="lastname"
                value={formData.lastname}
                onChange={handleChange}
                placeholder="Dupont"
              />
            </div>
          </div>
          
          <div className="form-group">
            <label htmlFor="email">Email *</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="votre@email.com"
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="password">Mot de passe *</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="••••••••"
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="confirmPassword">Confirmer le mot de passe *</label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="••••••••"
              required
            />
          </div>
          
          <button 
            type="submit" 
            className="btn btn-primary btn-block"
            disabled={loading}
          >
            {loading ? 'Inscription...' : 'S\'inscrire'}
          </button>
        </form>
        
        <div className="auth-footer">
          <p>Déjà un compte ? <Link to="/login">Se connecter</Link></p>
          <p><Link to="/">Retour à la carte</Link></p>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
