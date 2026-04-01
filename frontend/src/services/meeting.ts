import api from '@/lib/axios';

export type MeetingStatus = 'open' | 'closed' | 'cancelled';

export interface MeetingTaskResult {
  finalScore: number;
  voteCount: number;
  approvalCount: number;
  challengeCount: number;
  medianScore: number;
}

export interface ReviewVote {
  id: string;
  meetingId: string;
  taskId: string;
  userId: string;
  tenantId: string;
  score: number | null;
  isApproval: boolean;
  createdAt: string;
}

export interface TaskContribution {
  id: string;
  taskId: string;
  userId: string;
  tenantId: string;
  percentage: number;
  setInMeetingId: string;
  createdAt: string;
}

export interface ReviewMeeting {
  id: string;
  tenantId: string;
  projectId: string;
  createdBy: string;
  status: MeetingStatus;
  taskIds: string[];
  results: Record<string, MeetingTaskResult> | null;
  participantCount: number;
  createdAt: string;
  closedAt: string | null;
  votes?: ReviewVote[];
  contributions?: TaskContribution[];
}

export const meetingApi = {
  create(projectId: string) {
    return api.post<ReviewMeeting>('/meetings', { projectId });
  },

  list(projectId?: string) {
    return api.get<ReviewMeeting[]>('/meetings', {
      params: projectId ? { projectId } : {},
    });
  },

  get(id: string) {
    return api.get<ReviewMeeting>(`/meetings/${id}`);
  },

  close(id: string) {
    return api.patch<ReviewMeeting>(`/meetings/${id}/close`);
  },
};
