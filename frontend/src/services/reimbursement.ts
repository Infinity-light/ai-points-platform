import api from '@/lib/axios';

export interface ReimbursementItem {
  id: string;
  description: string;
  amount: number;
  expenseDate: string;
  receiptUploadIds: string[];
}

export interface Reimbursement {
  id: string;
  tenantId: string;
  submitterId: string;
  reimbursementType: string;
  status: string;
  title: string;
  totalAmount: number;
  linkedAssetId: string | null;
  approvalInstanceId: string | null;
  paidAt: string | null;
  paymentReference: string | null;
  notes: string | null;
  items: ReimbursementItem[];
  createdAt: string;
  updatedAt: string;
}

export const reimbursementApi = {
  list: (params?: Record<string, string>) =>
    api.get<Reimbursement[]>('/reimbursements', { params }).then((r) => r.data),
  create: (data: unknown) => api.post<Reimbursement>('/reimbursements', data).then((r) => r.data),
  get: (id: string) => api.get<Reimbursement>(`/reimbursements/${id}`).then((r) => r.data),
  update: (id: string, data: unknown) =>
    api.patch<Reimbursement>(`/reimbursements/${id}`, data).then((r) => r.data),
  submit: (id: string, data?: { departmentHeadId?: string }) =>
    api.post<Reimbursement>(`/reimbursements/${id}/submit`, data ?? {}).then((r) => r.data),
  markPaid: (id: string, data?: { paymentReference?: string }) =>
    api.post<Reimbursement>(`/reimbursements/${id}/pay`, data ?? {}).then((r) => r.data),
  markComplete: (id: string) =>
    api.post<Reimbursement>(`/reimbursements/${id}/complete`).then((r) => r.data),
  delete: (id: string) => api.delete(`/reimbursements/${id}`),
};
