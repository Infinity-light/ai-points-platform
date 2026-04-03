import { Injectable } from '@nestjs/common';
import {
  BrainPlugin,
  BrainTool,
  BrainToolContext,
} from '../../interfaces/brain-plugin.interface';
import { AuctionService } from '../../../auction/auction.service';

@Injectable()
export class AuctionPlugin implements BrainPlugin {
  id = 'builtin:auction';
  name = '竞拍管理';
  type = 'builtin' as const;

  constructor(private readonly auctionService: AuctionService) {}

  get tools(): BrainTool[] {
    return [
      {
        name: 'auction_list',
        description: '列出当前租户的所有竞拍，可按状态和类型筛选',
        inputSchema: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              description: '按状态筛选 (open/closed/cancelled)',
            },
            type: {
              type: 'string',
              description: '按类型筛选 (task_claim/reward/custom)',
            },
          },
        },
        call: async (input: Record<string, unknown>, ctx: BrainToolContext) => {
          const auctions = await this.auctionService.list({
            tenantId: ctx.tenantId,
            filters: {
              ...(input.status ? { status: input.status as any } : {}),
              ...(input.type ? { type: input.type as any } : {}),
            },
          });
          return auctions.map((a) => ({
            id: a.id,
            type: a.type,
            description: a.description,
            status: a.status,
            minBid: a.minBid,
            endsAt: a.endsAt,
          }));
        },
      },
      {
        name: 'auction_get',
        description: '获取单个竞拍的详细信息，包括所有出价记录',
        inputSchema: {
          type: 'object',
          properties: {
            auctionId: { type: 'string', description: '竞拍 ID' },
          },
          required: ['auctionId'],
        },
        call: async (input: Record<string, unknown>, ctx: BrainToolContext) => {
          return this.auctionService.get({
            auctionId: input.auctionId as string,
            tenantId: ctx.tenantId,
          });
        },
      },
      {
        name: 'auction_place_bid',
        description: '在竞拍中出价。金额必须大于当前最高出价。',
        inputSchema: {
          type: 'object',
          properties: {
            auctionId: { type: 'string', description: '竞拍 ID' },
            amount: { type: 'number', description: '出价金额（活跃工分）' },
          },
          required: ['auctionId', 'amount'],
        },
        requiredPermission: { resource: 'auctions', action: 'create' },
        call: async (input: Record<string, unknown>, ctx: BrainToolContext) => {
          const bid = await this.auctionService.placeBid({
            auctionId: input.auctionId as string,
            userId: ctx.userId,
            tenantId: ctx.tenantId,
            amount: input.amount as number,
          });
          return { bidId: bid.id, amount: bid.amount };
        },
      },
    ];
  }

  async initialize(): Promise<void> {}
  async destroy(): Promise<void> {}
}
