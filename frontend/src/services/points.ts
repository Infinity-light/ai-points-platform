import api from '@/lib/axios';

export interface PointsTableRow {
  userId: string;
  userName: string;
  originalTotal: number;
  activeTotal: number;
  ratio: number;
}

export interface PointsTableSummary {
  totalActive: number;
  totalOriginal: number;
  rows: PointsTableRow[];
}

export interface ApprovalBatch {
  id: string;
  projectId: string;
  projectName?: string;
  submittedBy: string;
  submitterName?: string;
  pointRecordIds: string[];
  totalPoints: number;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy: string | null;
  reviewNote: string | null;
  createdAt: string;
}

export interface ApprovalBatchDetail extends ApprovalBatch {
  pointRecords: PointRecord[];
}

export interface PointRecord {
  id: string;
  taskId: string;
  taskTitle: string;
  points: number;
  acquiredAt: string;
}

export interface MyProjectPoints {
  projectId: string;
  projectName: string;
  originalTotal: number;
  activeTotal: number;
  currentRound: number;
  approvedCount: number;
  pendingCount: number;
  projectOnlyCount: number;
}

export const pointsApi = {
  getProjectPointsTable: (projectId: string) =>
    api.get<PointsTableSummary>(`/points/project/${projectId}/points-table`),
  getMyProjects: () => api.get<MyProjectPoints[]>('/points/my-projects'),
};

export const approvalApi = {
  list: () => api.get<ApprovalBatch[]>('/admin/approval-batches'),
  get: (id: string) => api.get<ApprovalBatchDetail>(`/admin/approval-batches/${id}`),
  approve: (id: string) => api.patch<ApprovalBatch>(`/admin/approval-batches/${id}/approve`),
  reject: (options: { id: string; reviewNote?: string }) =>
    api.patch<ApprovalBatch>(`/admin/approval-batches/${options.id}/reject`, {
      reviewNote: options.reviewNote,
    }),
};
