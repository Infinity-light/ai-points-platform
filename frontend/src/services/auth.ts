import api from '@/lib/axios';

export interface RegisterPayload {
  email: string;
  password: string;
  name: string;
  phone?: string;
  inviteCode?: string;
  tenantSlug: string;
}

export interface LoginPayload {
  email: string;
  password: string;
  tenantSlug: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  tenantId: string;
  isEmailVerified: boolean;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export const authApi = {
  register(payload: RegisterPayload) {
    return api.post<{ userId: string; message: string }>('/auth/register', payload);
  },
  verifyEmail(userId: string, code: string) {
    return api.post<AuthResponse>('/auth/verify-email', { userId, code });
  },
  resendVerification(userId: string) {
    return api.post<{ message: string }>('/auth/resend-verification', { userId });
  },
  login(payload: LoginPayload) {
    return api.post<AuthResponse>('/auth/login', payload);
  },
  logout() {
    return api.post('/auth/logout');
  },
};
