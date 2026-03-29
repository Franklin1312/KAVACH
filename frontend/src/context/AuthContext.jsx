import React, { createContext, useContext, useState, useEffect } from 'react';
import { getMe } from '../services/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [worker, setWorker]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('kavach_token');
    if (token) {
      getMe()
        .then(({ data }) => setWorker(data.worker))
        .catch(() => localStorage.removeItem('kavach_token'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = (token, workerData) => {
    localStorage.setItem('kavach_token', token);
    setWorker(workerData);
  };

  const logout = () => {
    localStorage.removeItem('kavach_token');
    setWorker(null);
  };

  return (
    <AuthContext.Provider value={{ worker, setWorker, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
