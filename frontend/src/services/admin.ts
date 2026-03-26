import api from '@/lib/axios';

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
  tenantId: string;
  isEmailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface InviteCode {
  id: string;
  code: string;
  note: string | null;
  usedCount: number;
  maxUses: number;
  isActive: boolean;
  expiresAt: string | null;
  createdBy: string;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

export interface TenantStats {
  totalUsers: number;
  usersByRole: Record<string, number>;
  totalPointsAwarded: number;
  activeInviteCodes: number;
}

export const adminApi = {
  listUsers: () => api.get<AdminUser[]>('/admin/users').then((r) => r.data),
  updateUserRole: (userId: string, role: string) =>
    api.patch<AdminUser>(`/admin/users/${userId}/role`, { role }).then((r) => r.data),
  getStats: () => api.get<TenantStats>('/admin/stats').then((r) => r.data),
  listInvites: () => api.get<InviteCode[]>('/admin/invites').then((r) => r.data),
  toggleInvite: (id: string, isActive: boolean) =>
    api.patch<InviteCode>(`/admin/invites/${id}/toggle`, { isActive }).then((r) => r.data),
};
