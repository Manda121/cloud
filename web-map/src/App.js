import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ManagerDashboard from './pages/ManagerDashboard';
import ManageSignalementsPage from './pages/ManageSignalementsPage';
import ManageUsersPage from './pages/ManageUsersPage';
import ConfigPrixPage from './pages/ConfigPrixPage';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="app">
          <Navbar />
          <main className="main-content">
            <Routes>
              {/* Routes publiques (Visiteur) */}
              <Route path="/" element={<HomePage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              
              {/* Routes protégées (Manager) */}
              <Route path="/manager" element={
                <ProtectedRoute>
                  <ManagerDashboard />
                </ProtectedRoute>
              } />
              <Route path="/manager/signalements" element={
                <ProtectedRoute>
                  <ManageSignalementsPage />
                </ProtectedRoute>
              } />
              <Route path="/manager/users" element={
                <ProtectedRoute>
                  <ManageUsersPage />
                </ProtectedRoute>
              } />
              <Route path="/manager/prix" element={
                <ProtectedRoute>
                  <ConfigPrixPage />
                </ProtectedRoute>
              } />
            </Routes>
          </main>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
