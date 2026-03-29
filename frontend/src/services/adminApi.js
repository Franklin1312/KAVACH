import axios from 'axios';

const ADMIN_API = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api',
});

ADMIN_API.interceptors.request.use((config) => {
  const token = localStorage.getItem('kavach_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const getAdminStats    = () => ADMIN_API.get('/admin/stats');
export const getAdminClaims   = () => ADMIN_API.get('/admin/claims');
export const getAdminWorkers  = () => ADMIN_API.get('/admin/workers');

export default ADMIN_API;
