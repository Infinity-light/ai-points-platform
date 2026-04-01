import api from '@/lib/axios';

export type AuctionType = 'task_claim' | 'reward' | 'custom';
export type AuctionStatus = 'open' | 'closed' | 'cancelled';

export interface Bid {
  id: string;
  auctionId: string;
  userId: string;
  tenantId: string;
  amount: number;
  createdAt: string;
}

export interface Auction {
  id: string;
  tenantId: string;
  type: AuctionType;
  targetEntity: string | null;
  targetId: string | null;
  description: string;
  status: AuctionStatus;
  minBid: number;
  endsAt: string;
  winnerId: string | null;
  winningBid: number | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  bids?: Bid[];
}

export interface CreateAuctionPayload {
  type: AuctionType;
  targetEntity?: string;
  targetId?: string;
  description: string;
  minBid?: number;
  endsAt: string;
}

export const auctionApi = {
  list: (params?: { status?: AuctionStatus; type?: AuctionType }) =>
    api.get<Auction[]>('/auctions', { params }),

  get: (id: string) =>
    api.get<Auction & { bids: Bid[] }>(`/auctions/${id}`),

  create: (payload: CreateAuctionPayload) =>
    api.post<Auction>('/auctions', payload),

  placeBid: (id: string, amount: number) =>
    api.post<Bid>(`/auctions/${id}/bid`, { amount }),

  cancel: (id: string) =>
    api.patch<Auction>(`/auctions/${id}/cancel`),
};
