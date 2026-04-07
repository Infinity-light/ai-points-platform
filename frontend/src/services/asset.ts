import api from '@/lib/axios';

export interface Asset {
  id: string;
  tenantId: string;
  assetCode: string;
  name: string;
  assetType: string;
  category: string;
  status: string;
  purchasePrice: number | null;
  usefulLifeMonths: number | null;
  residualValue: number | null;
  purchaseDate: string | null;
  vendor: string | null;
  serialNumber: string | null;
  expiresAt: string | null;
  assignedUserId: string | null;
  departmentId: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AssetOperation {
  id: string;
  assetId: string;
  operationType: string;
  fromUserId: string | null;
  toUserId: string | null;
  approvalInstanceId: string | null;
  notes: string | null;
  operatedBy: string;
  createdAt: string;
}

export interface DepreciationResult {
  accumulated: number;
  bookValue: number;
  monthlyRate: number;
}

export const assetApi = {
  list: (params?: Record<string, string>) =>
    api.get<Asset[]>('/assets', { params }).then((r) => r.data),
  create: (data: Partial<Asset>) => api.post<Asset>('/assets', data).then((r) => r.data),
  get: (id: string) => api.get<Asset>(`/assets/${id}`).then((r) => r.data),
  update: (id: string, data: Partial<Asset>) =>
    api.patch<Asset>(`/assets/${id}`, data).then((r) => r.data),
  executeOperation: (
    id: string,
    data: { operationType: string; toUserId?: string; notes?: string },
  ) => api.post<AssetOperation>(`/assets/${id}/operations`, data).then((r) => r.data),
  getOperations: (id: string) =>
    api.get<AssetOperation[]>(`/assets/${id}/operations`).then((r) => r.data),
  getDepreciation: (id: string) =>
    api.get<DepreciationResult>(`/assets/${id}/depreciation`).then((r) => r.data),
};
