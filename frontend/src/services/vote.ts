import api from '@/lib/axios';

export interface VoteSession {
  id: string;
  tenantId: string;
  projectId: string;
  status: 'open' | 'closed' | 'passed' | 'failed';
  createdBy: string;
  taskIds: string[];
  result: {
    totalWeight?: number;
    yesWeight?: number;
    noWeight?: number;
    participantCount?: number;
    totalMemberCount?: number;
    weightedYesRatio?: number;
    participationRatio?: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface VoteRecord {
  id: string;
  voteSessionId: string;
  userId: string;
  vote: boolean;
  weight: number;
  createdAt: string;
}

export const voteApi = {
  createSession: (projectId: string, taskIds: string[]) =>
    api.post<VoteSession>('/vote-sessions', { projectId, taskIds }),
  listByProject: (projectId: string) =>
    api.get<VoteSession[]>(`/vote-sessions/project/${projectId}`),
  getSession: (id: string) => api.get<VoteSession>(`/vote-sessions/${id}`),
  castVote: (sessionId: string, vote: boolean) =>
    api.post<VoteRecord>(`/vote-sessions/${sessionId}/votes`, { vote }),
  closeSession: (sessionId: string) =>
    api.patch<VoteSession>(`/vote-sessions/${sessionId}/close`),
  getVotes: (sessionId: string) => api.get<VoteRecord[]>(`/vote-sessions/${sessionId}/votes`),
};
