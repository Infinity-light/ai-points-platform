import api from '@/lib/axios';

export interface ApprovalConfig {
  id: string;
  tenantId: string;
  configType: string;
  deptApproverMode: string;
  financePersonId: string | null;
  finalApproverId: string | null;
  isActive: boolean;
}

export interface ApprovalRecord {
  id: string;
  approverId: string;
  step: number;
  action: string;
  comment: string | null;
  createdAt: string;
}

export interface ApprovalInstance {
  id: string;
  businessType: string;
  businessId: string;
  submitterId: string;
  status: string;
  currentStep: number;
  step1ApproverId: string | null;
  step2ApproverId: string | null;
  step3ApproverId: string | null;
  completedAt: string | null;
  records: ApprovalRecord[];
}

export const approvalApi = {
  getConfigs: () => api.get<ApprovalConfig[]>('/approval/configs').then((r) => r.data),
  upsertConfig: (data: Partial<ApprovalConfig>) =>
    api.post<ApprovalConfig>('/approval/configs', data).then((r) => r.data),
  getPending: () => api.get<ApprovalInstance[]>('/approval/instances/pending').then((r) => r.data),
  getInstance: (id: string) =>
    api.get<ApprovalInstance>(`/approval/instances/${id}`).then((r) => r.data),
  approve: (id: string, data: { action: string; comment?: string }) =>
    api.post<ApprovalInstance>(`/approval/instances/${id}/approve`, data).then((r) => r.data),
};
