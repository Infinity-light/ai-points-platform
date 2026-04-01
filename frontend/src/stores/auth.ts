import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import api from '@/lib/axios';
import { usePermissionStore } from '@/stores/permission';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  tenantId: string;
  tenantName?: string;
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
    // Load permissions after login
    const permissionStore = usePermissionStore();
    void permissionStore.fetchPermissions();
  }

  async function fetchUser(): Promise<void> {
    if (!accessToken.value) return;
    // Always ensure permissions are loaded
    const permissionStore = usePermissionStore();
    if (!permissionStore.loaded) {
      void permissionStore.fetchPermissions();
    }
    if (userLoaded.value) return;
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
    const permissionStore = usePermissionStore();
    permissionStore.reset();
  }

  return { user, accessToken, refreshToken, isAuthenticated, userLoaded, setAuth, logout, tryRefreshToken, fetchUser };
});
