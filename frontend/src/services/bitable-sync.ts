import api from '@/lib/axios';

export interface BitableBinding {
  id: string;
  tenantId: string;
  projectId: string;
  appToken: string;
  tableId: string;
  entityType: string;
  syncDirection: string;
  conflictStrategy: string;
  isActive: boolean;
  fieldMapping: Record<string, string>;
  syncStatus: string;
  lastSyncAt: string | null;
  lastSyncError: string | null;
}

export interface BitableSyncLog {
  id: string;
  bindingId: string;
  syncType: string;
  direction: string;
  status: string;
  recordsProcessed: number;
  recordsCreated: number;
  recordsUpdated: number;
  recordsFailed: number;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
}

export const bitableSyncApi = {
  listBindings: () => api.get<BitableBinding[]>('/admin/bitable-sync/bindings').then((r) => r.data),
  createBinding: (data: Partial<BitableBinding>) =>
    api.post<BitableBinding>('/admin/bitable-sync/bindings', data).then((r) => r.data),
  updateBinding: (id: string, data: Partial<BitableBinding>) =>
    api.patch<BitableBinding>(`/admin/bitable-sync/bindings/${id}`, data).then((r) => r.data),
  deleteBinding: (id: string) => api.delete(`/admin/bitable-sync/bindings/${id}`),
  triggerSync: (id: string) => api.post(`/admin/bitable-sync/bindings/${id}/sync`),
  getLogs: (id: string) =>
    api.get<BitableSyncLog[]>(`/admin/bitable-sync/bindings/${id}/logs`).then((r) => r.data),
};
