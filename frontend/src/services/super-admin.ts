import api from '@/lib/axios';

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GlobalConfig {
  llmModel: string;
  llmBaseUrl: string;
  maxFileSizeMb: number;
}

export interface OpsStats {
  totalTenants: number;
  totalUsers: number;
  totalTasks: number;
  totalSubmissions: number;
}

export const superAdminApi = {
  listTenants: () => api.get<Tenant[]>('/super-admin/tenants').then((r) => r.data),
  createTenant: (data: { name: string; slug: string }) =>
    api.post<Tenant>('/super-admin/tenants', data).then((r) => r.data),
  updateTenant: (id: string, data: object) =>
    api.patch<Tenant>(`/super-admin/tenants/${id}`, data).then((r) => r.data),
  deleteTenant: (id: string) => api.delete(`/super-admin/tenants/${id}`),
  getConfig: () => api.get<GlobalConfig>('/super-admin/config').then((r) => r.data),
  updateConfig: (data: object) =>
    api.patch<GlobalConfig>('/super-admin/config', data).then((r) => r.data),
  getOps: () => api.get<OpsStats>('/super-admin/ops').then((r) => r.data),
};
