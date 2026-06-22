import axios from 'axios';
import { auth } from './firebase';

// Empty baseURL → Vite proxy forwards /api/* to the Express server in dev.
// Set VITE_API_BASE_URL in production to point at the deployed server.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '',
});

api.interceptors.request.use(async (config) => {
  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
