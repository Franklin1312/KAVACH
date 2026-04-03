import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider, useLanguage } from './context/LanguageContext';

import Onboarding     from './pages/Onboarding/Onboarding';
import Dashboard      from './pages/Dashboard/Dashboard';
import PolicyPage     from './pages/Policy/PolicyPage';
import ClaimsPage     from './pages/Claims/ClaimsPage';
import AdminDashboard from './pages/Admin/AdminDashboard';

// Redirect to dashboard if already logged in
const PublicRoute = ({ children }) => {
  const { worker, loading } = useAuth();
  const { t } = useLanguage();
  if (loading) return <div style={{ padding: 40, color: '#8b949e' }}>{t('common.loading', 'Loading...')}</div>;
  return worker ? <Navigate to="/dashboard" replace /> : children;
};

// Redirect to login if not logged in
const PrivateRoute = ({ children }) => {
  const { worker, loading } = useAuth();
  const { t } = useLanguage();
  if (loading) return <div style={{ padding: 40, color: '#8b949e' }}>{t('common.loading', 'Loading...')}</div>;
  return worker ? children : <Navigate to="/" replace />;
};

export default function App() {
  return (
    <AuthProvider>
      <LanguageProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/"          element={<PublicRoute><Onboarding /></PublicRoute>} />
            <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
            <Route path="/policy"    element={<PrivateRoute><PolicyPage /></PrivateRoute>} />
            <Route path="/claims"    element={<PrivateRoute><ClaimsPage /></PrivateRoute>} />
            <Route path="/admin"     element={<AdminDashboard />} />
            <Route path="*"          element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </LanguageProvider>
    </AuthProvider>
  );
}
