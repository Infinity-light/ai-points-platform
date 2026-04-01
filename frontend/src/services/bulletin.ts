import api from '@/lib/axios';

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  userName: string;
  rawPoints: number;
  activePoints: number;
}

export interface LeaderboardResult {
  projectId: string | null;
  settlementId: string | null;
  entries: LeaderboardEntry[];
  snapshotAt: string | null;
}

export interface Settlement {
  id: string;
  tenantId: string;
  projectId: string;
  roundNumber: number;
  triggeredBy: string;
  voteSessionId: string;
  settledTaskIds: string[];
  summary: {
    totalPointsAwarded: number;
    usersAffected: number;
  };
  createdAt: string;
}

export interface Dividend {
  id: string;
  tenantId: string;
  projectId: string;
  settlementId: string;
  roundNumber: number;
  totalAmount: number | null;
  totalActivePoints: number;
  details: Record<string, {
    userName: string;
    activePoints: number;
    ratio: number;
    amount: number | null;
  }>;
  status: string;
  createdAt: string;
}

export interface DecisionEntry {
  meetingId: string;
  projectId: string;
  status: string;
  taskCount: number;
  participantCount: number;
  createdAt: string;
  closedAt: string | null;
  results: Record<string, {
    finalScore: number;
    voteCount: number;
    approvalCount: number;
    challengeCount: number;
    medianScore: number;
  }> | null;
}

export interface AuditTrailEntry {
  id: string;
  actorName: string;
  action: string;
  resource: string;
  resourceId: string | null;
  createdAt: string;
  previousData: Record<string, unknown> | null;
  newData: Record<string, unknown> | null;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
  };
}

export const bulletinApi = {
  getLeaderboard: (params?: { projectId?: string }) =>
    api.get<LeaderboardResult>('/bulletin/leaderboard', { params }),

  getSettlements: (params?: { page?: number; limit?: number }) =>
    api.get<PaginatedResult<Settlement>>('/bulletin/settlements', { params }),

  getDividends: (params?: { page?: number; limit?: number }) =>
    api.get<PaginatedResult<Dividend>>('/bulletin/dividends', { params }),

  getDecisions: (params?: { page?: number; limit?: number }) =>
    api.get<PaginatedResult<DecisionEntry>>('/bulletin/decisions', { params }),

  getAuditTrail: (params?: { page?: number; limit?: number }) =>
    api.get<PaginatedResult<AuditTrailEntry>>('/bulletin/audit-trail', { params }),
};
