import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ManagerDashboard from './pages/ManagerDashboard';
import ManageUsersPage from './pages/ManageUsersPage';
import ManageSignalementsPage from './pages/ManageSignalementsPage';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="app">
          <Navbar />
          <main className="main-content">
            <Routes>
              {/* Page publique - Visiteur */}
              <Route path="/" element={<HomePage />} />
              
              {/* Pages d'authentification */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              
              {/* Pages protégées - Manager */}
              <Route
                path="/manager"
                element={
                  <ProtectedRoute>
                    <ManagerDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/manager/users"
                element={
                  <ProtectedRoute>
                    <ManageUsersPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/manager/signalements"
                element={
                  <ProtectedRoute>
                    <ManageSignalementsPage />
                  </ProtectedRoute>
                }
              />
              
              {/* Redirection par défaut */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
