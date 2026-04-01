import api from '@/lib/axios';

export type TaskStatus = 'open' | 'claimed' | 'submitted' | 'ai_reviewing' | 'pending_review' | 'pending_vote' | 'settled' | 'cancelled';

export interface Task {
  id: string;
  tenantId: string;
  projectId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  assigneeId: string | null;
  createdBy: string;
  metadata: {
    estimatedPoints?: number;
    aiScores?: { research: number; planning: number; execution: number; average: number };
    finalPoints?: number;
    tags?: string[];
    priority?: 'low' | 'medium' | 'high';
    [key: string]: unknown;
  };
  estimatedPoints: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskPayload {
  title: string;
  description?: string;
  estimatedPoints?: number;
  metadata?: Record<string, unknown>;
}

export const taskApi = {
  list: (projectId: string) => api.get<Task[]>(`/projects/${projectId}/tasks`),
  get: (projectId: string, taskId: string) => api.get<Task>(`/projects/${projectId}/tasks/${taskId}`),
  create: (projectId: string, payload: CreateTaskPayload) =>
    api.post<Task>(`/projects/${projectId}/tasks`, payload),
  update: (projectId: string, taskId: string, payload: Partial<CreateTaskPayload>) =>
    api.patch<Task>(`/projects/${projectId}/tasks/${taskId}`, payload),
  transition: (projectId: string, taskId: string, status: TaskStatus) =>
    api.patch<Task>(`/projects/${projectId}/tasks/${taskId}/transition`, { status }),
};

export interface Submission {
  id: string;
  taskId: string;
  submittedBy: string;
  type: 'explore' | 'ai-exec' | 'manual';
  content: string;
  metadata: Record<string, unknown>;
  aiReviewStatus: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: string;
}

export const submissionApi = {
  create: (payload: { taskId: string; type: string; content: string; metadata?: Record<string, unknown> }) =>
    api.post<Submission>('/submissions', payload),
  listByTask: (taskId: string) => api.get<Submission[]>(`/submissions/task/${taskId}`),
};
