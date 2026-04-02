import api from '@/lib/axios';

export interface RegisterPayload {
  email: string;
  password: string;
  name: string;
  phone?: string;
  tenantSlug: string;
}

export interface RegisterOrgPayload {
  orgName: string;
  orgSlug: string;
  email: string;
  password: string;
  name: string;
  phone?: string;
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
    return api.post<{ pendingId: string; message: string }>('/auth/register', payload);
  },
  registerOrg(payload: RegisterOrgPayload) {
    return api.post<{ pendingId: string; message: string }>('/auth/register-org', payload);
  },
  verifyEmail(pendingId: string, code: string) {
    return api.post<AuthResponse>('/auth/verify-email', { pendingId, code });
  },
  resendVerification(pendingId: string) {
    return api.post<{ message: string }>('/auth/resend-verification', { pendingId });
  },
  login(payload: LoginPayload) {
    return api.post<AuthResponse>('/auth/login', payload);
  },
  logout() {
    return api.post('/auth/logout');
  },
};
