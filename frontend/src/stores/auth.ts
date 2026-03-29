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
  const savedUser = localStorage.getItem('user');
  const user = ref<AuthUser | null>(savedUser ? JSON.parse(savedUser) as AuthUser : null);
  const accessToken = ref<string | null>(localStorage.getItem('access_token'));
  const refreshToken = ref<string | null>(localStorage.getItem('refresh_token'));
  const userLoaded = ref(!!savedUser);

  const isAuthenticated = computed(() => !!accessToken.value);

  function setAuth(userData: AuthUser, access: string, refresh: string) {
    user.value = userData;
    userLoaded.value = true;
    accessToken.value = access;
    refreshToken.value = refresh;
    localStorage.setItem('access_token', access);
    localStorage.setItem('refresh_token', refresh);
    localStorage.setItem('user', JSON.stringify(userData));
  }

  async function fetchUser(): Promise<void> {
    if (userLoaded.value || !accessToken.value) return;
    try {
      const res = await api.get<AuthUser>('/users/me');
      user.value = res.data;
      userLoaded.value = true;
      localStorage.setItem('user', JSON.stringify(res.data));
    } catch {
      // Token invalid — clear auth
      logout();
    }
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
    userLoaded.value = false;
    accessToken.value = null;
    refreshToken.value = null;
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
  }

  return { user, accessToken, refreshToken, isAuthenticated, userLoaded, setAuth, logout, tryRefreshToken, fetchUser };
});
