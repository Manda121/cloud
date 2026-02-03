import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Navbar.css';

const Navbar = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <Link to="/">
          <span className="logo">🛣️</span>
          <span className="brand-text">Travaux Routiers - Antananarivo</span>
        </Link>
      </div>

      <div className="navbar-menu">
        <Link to="/" className="nav-link">Carte</Link>
        
        {isAuthenticated ? (
          <>
            <Link to="/manager" className="nav-link">Dashboard</Link>
            <Link to="/manager/signalements" className="nav-link">Signalements</Link>
            <Link to="/manager/users" className="nav-link">Utilisateurs</Link>
            <div className="user-info">
              <span className="user-name">{user?.firstname || user?.email}</span>
              <button onClick={handleLogout} className="btn-logout">
                Déconnexion
              </button>
            </div>
          </>
        ) : (
          <>
            <Link to="/login" className="nav-link">Connexion</Link>
            <Link to="/register" className="nav-link btn-register">Inscription</Link>
          </>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
