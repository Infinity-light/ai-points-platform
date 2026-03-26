import api from '@/lib/axios';

export interface CreateProjectPayload {
  name: string;
  description?: string;
  annealingConfig?: { cyclesPerStep?: number; maxSteps?: number };
  settlementConfig?: { periodType?: 'weekly' | 'monthly'; dayOfWeek?: number; dayOfMonth?: number };
}

export interface Project {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  status: 'active' | 'archived';
  annealingConfig: { cyclesPerStep: number; maxSteps: number };
  settlementConfig: { periodType: 'weekly' | 'monthly'; dayOfWeek?: number; dayOfMonth?: number };
  createdBy: string;
  settlementRound: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  tenantId: string;
  joinedAt: string;
}

export const projectApi = {
  list: (mine = true) => api.get<Project[]>(`/projects${mine ? '?mine=true' : ''}`),
  get: (id: string) => api.get<Project>(`/projects/${id}`),
  create: (payload: CreateProjectPayload) => api.post<Project>('/projects', payload),
  update: (id: string, payload: Partial<CreateProjectPayload>) => api.patch<Project>(`/projects/${id}`, payload),
  archive: (id: string) => api.patch<Project>(`/projects/${id}/archive`),
  getMembers: (id: string) => api.get<ProjectMember[]>(`/projects/${id}/members`),
  addMember: (id: string, userId: string) => api.post<ProjectMember>(`/projects/${id}/members`, { userId }),
  removeMember: (id: string, userId: string) => api.delete(`/projects/${id}/members/${userId}`),
};
