import axios from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: automatically attach JWT token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Track whether a token refresh is already in flight
let refreshPromise: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  const refreshToken = localStorage.getItem('refresh_token');
  if (!refreshToken) return false;

  try {
    // Use a raw axios call to avoid interceptor loops
    const res = await axios.post<{ accessToken: string; refreshToken: string }>(
      '/api/auth/refresh',
      {},
      { headers: { Authorization: `Bearer ${refreshToken}` } },
    );
    localStorage.setItem('access_token', res.data.accessToken);
    localStorage.setItem('refresh_token', res.data.refreshToken);
    return true;
  } catch {
    return false;
  }
}

// Response interceptor: auto-refresh on 401, then retry once
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retried?: boolean };
    const url = originalRequest?.url ?? '';
    const isAuthRequest = url.startsWith('/auth/');

    // Only attempt refresh for non-auth 401s that haven't been retried
    if (error.response?.status === 401 && !isAuthRequest && !originalRequest._retried) {
      originalRequest._retried = true;

      // Deduplicate concurrent refresh attempts
      if (!refreshPromise) {
        refreshPromise = tryRefresh().finally(() => { refreshPromise = null; });
      }

      const refreshed = await refreshPromise;
      if (refreshed) {
        // Update the header and retry the original request
        originalRequest.headers.Authorization = `Bearer ${localStorage.getItem('access_token')}`;
        return api(originalRequest);
      }

      // Refresh failed — clear everything and redirect
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }

    return Promise.reject(error);
  },
);

export default api;
