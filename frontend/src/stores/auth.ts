import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import api from '@/lib/axios';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  tenantId: string;
  isEmailVerified: boolean;
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(null);
  const accessToken = ref<string | null>(localStorage.getItem('access_token'));
  const refreshToken = ref<string | null>(localStorage.getItem('refresh_token'));

  const isAuthenticated = computed(() => !!accessToken.value);

  function setAuth(userData: AuthUser, access: string, refresh: string) {
    user.value = userData;
    accessToken.value = access;
    refreshToken.value = refresh;
    localStorage.setItem('access_token', access);
    localStorage.setItem('refresh_token', refresh);
  }

  async function tryRefreshToken(): Promise<boolean> {
    const token = refreshToken.value;
    if (!token) return false;
    try {
      const res = await api.post<{ accessToken: string; refreshToken: string }>(
        '/auth/refresh',
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      );
      accessToken.value = res.data.accessToken;
      refreshToken.value = res.data.refreshToken;
      localStorage.setItem('access_token', res.data.accessToken);
      localStorage.setItem('refresh_token', res.data.refreshToken);
      return true;
    } catch {
      logout();
      return false;
    }
  }

  function logout() {
    user.value = null;
    accessToken.value = null;
    refreshToken.value = null;
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  }

  return { user, accessToken, refreshToken, isAuthenticated, setAuth, logout, tryRefreshToken };
});
