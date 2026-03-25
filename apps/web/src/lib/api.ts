import axios from 'axios';
import { clearAccessToken, readAccessToken } from './session-storage';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para adicionar o token de auth em requests futuras
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = readAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (typeof window !== 'undefined' && error?.response?.status === 401) {
      clearAccessToken();
      window.dispatchEvent(new Event('saaso-auth-expired'));
    }

    return Promise.reject(error);
  },
);

export default api;
