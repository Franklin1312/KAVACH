import axios from 'axios';

const API = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api',
});

// Attach token to every request automatically
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('kavach_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const sendOTP      = (phone)       => API.post('/auth/send-otp',    { phone });
export const verifyOTP    = (phone, otp)  => API.post('/auth/verify-otp',  { phone, otp });
export const registerWorker = (data)      => API.post('/auth/register',    data);

// ─── Worker ───────────────────────────────────────────────────────────────────
export const getMe        = ()            => API.get('/workers/me');
export const updateMe     = (data)        => API.put('/workers/me', data);

// ─── Policies ─────────────────────────────────────────────────────────────────
export const getPremiumQuote   = (tier)   => API.get(`/policies/quote?tier=${tier}`);
export const getActivePolicty  = ()       => API.get('/policies/active');
export const getAllPolicies     = ()       => API.get('/policies');
export const createPolicy      = (tier)   => API.post('/policies', { tier });
export const cancelPolicy      = (id)     => API.put(`/policies/${id}/cancel`);

// ─── Claims ───────────────────────────────────────────────────────────────────
export const getAllClaims       = ()       => API.get('/claims');
export const getClaimById      = (id)     => API.get(`/claims/${id}`);
export const autoProcessClaim  = (data)   => API.post('/claims/auto-process', data);
export const verifyClaim       = (id)     => API.put(`/claims/${id}/verify`);

// ─── Triggers ─────────────────────────────────────────────────────────────────
export const getTriggerStatus  = ()       => API.get('/triggers/status');
export const simulateTrigger   = (type, level) => API.post('/triggers/simulate', { triggerType: type, level });
export const checkRain         = ()       => API.get('/triggers/check/rain');
export const checkAQI          = ()       => API.get('/triggers/check/aqi');

export default API;
