import api from '@/lib/axios';

export interface BitableField {
  fieldId: string;
  fieldName: string;
  type: number;
}

export interface BitableFieldMapping {
  title?: string;
  assignees?: string;
  status?: string;
  description?: string;
  attachments?: string;
  [key: string]: string | undefined;
}

export interface BitableBinding {
  id: string;
  appToken: string;
  tableId: string;
  fieldMapping: BitableFieldMapping;
  writebackFieldId: string | null;
  syncStatus: 'idle' | 'syncing' | 'error';
  lastSyncAt: string | null;
  lastSyncError: string | null;
}

export const bitableApi = {
  fetchFields: (projectId: string, appToken: string, tableId: string) =>
    api
      .post<{ fields: BitableField[] }>(`/projects/${projectId}/bitable/fetch-fields`, {
        appToken,
        tableId,
      })
      .then((r) => r.data),

  getBinding: (projectId: string) =>
    api.get<{ binding: BitableBinding | null; embedUrl: string | null }>(`/projects/${projectId}/bitable/binding`).then((r) => r.data),

  createBinding: (
    projectId: string,
    data: {
      appToken: string;
      tableId: string;
      fieldMapping: BitableFieldMapping;
      writebackFieldId: string;
    },
  ) =>
    api
      .post<BitableBinding>(`/projects/${projectId}/bitable/binding`, data)
      .then((r) => r.data),

  deleteBinding: (projectId: string) =>
    api.delete(`/projects/${projectId}/bitable/binding`),

  triggerSync: (projectId: string) =>
    api
      .post<{ jobId: string; message: string }>(`/projects/${projectId}/bitable/sync`)
      .then((r) => r.data),
};

export function getFeishuTableUrl(binding: BitableBinding, embedUrl?: string | null): string {
  if (embedUrl) return embedUrl;
  return `https://feishu.cn/base/${binding.appToken}?table=${binding.tableId}`;
}
