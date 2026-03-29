import api from '@/lib/axios';

export interface DividendDetailEntry {
  userName: string;
  activePoints: number;
  ratio: number;
  amount: number | null;
}

export interface Dividend {
  id: string;
  projectId: string;
  settlementId: string;
  roundNumber: number;
  totalAmount: number | null;
  totalActivePoints: number;
  details: Record<string, DividendDetailEntry>;
  status: 'draft' | 'pending_approval' | 'approved' | 'rejected';
  approvedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export const dividendApi = {
  listForProject: (projectId: string) =>
    api.get<Dividend[]>(`/dividends/project/${projectId}`),
  get: (id: string) => api.get<Dividend>(`/dividends/${id}`),
  fillAmount: (id: string, totalAmount: number) =>
    api.patch<Dividend>(`/dividends/${id}/fill-amount`, { totalAmount }),
  approve: (id: string) => api.patch<Dividend>(`/dividends/${id}/approve`),
  reject: (id: string) => api.patch<Dividend>(`/dividends/${id}/reject`),
};
