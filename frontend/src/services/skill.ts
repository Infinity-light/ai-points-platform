import api from '@/lib/axios';

export interface Skill {
  id: string;
  projectId: string;
  name: string;
  description: string;
  category: string | null;
  version: number;
  authorId: string;
  content: string;
  repoUrl: string | null;
  status: 'active' | 'deprecated';
  createdAt: string;
  updatedAt: string;
}

export const skillApi = {
  listForProject: (projectId: string) =>
    api.get<Skill[]>(`/projects/${projectId}/skills`),
  get: (id: string) => api.get<Skill>(`/skills/${id}`),
};
