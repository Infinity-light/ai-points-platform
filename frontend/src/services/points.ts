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

