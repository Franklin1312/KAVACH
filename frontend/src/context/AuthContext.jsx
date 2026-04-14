import React, { createContext, useContext, useState, useEffect } from 'react';
import { getMe } from '../services/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [worker, setWorker]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [admin, setAdmin] = useState(null);

  useEffect(() => {
    if (localStorage.getItem('kavach_admin_token')) {
      setIsAdmin(true);
      setAdmin({ username: localStorage.getItem('kavach_admin_username') || 'admin' });
    }

    const token = localStorage.getItem('kavach_token');
    if (token) {
      getMe()
        .then(({ data }) => setWorker(data.worker))
        .catch(() => {
          localStorage.removeItem('kavach_token');
          setWorker(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = (token, workerData) => {
    localStorage.removeItem('kavach_admin_token');
    localStorage.removeItem('kavach_admin_username');
    setIsAdmin(false);
    setAdmin(null);
    localStorage.setItem('kavach_token', token);
    setWorker(workerData);
  };

  const logout = () => {
    localStorage.removeItem('kavach_token');
    localStorage.removeItem('kavach_admin_token');
    localStorage.removeItem('kavach_admin_username');
    setWorker(null);
    setIsAdmin(false);
    setAdmin(null);
  };

  const adminLogin = (token, adminData) => {
    localStorage.removeItem('kavach_token');
    localStorage.setItem('kavach_admin_token', token);
    localStorage.setItem('kavach_admin_username', adminData?.username || 'admin');
    setWorker(null);
    setIsAdmin(true);
    setAdmin(adminData || { username: 'admin' });
  };

  const adminLogout = () => {
    localStorage.removeItem('kavach_admin_token');
    localStorage.removeItem('kavach_admin_username');
    setIsAdmin(false);
    setAdmin(null);
  };

  return (
    <AuthContext.Provider value={{ worker, setWorker, login, logout, loading, isAdmin, admin, adminLogin, adminLogout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
