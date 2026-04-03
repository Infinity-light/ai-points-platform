import { Injectable } from '@nestjs/common';
import {
  BrainPlugin,
  BrainTool,
  BrainToolContext,
} from '../../interfaces/brain-plugin.interface';
import { SettlementService } from '../../../settlement/settlement.service';

@Injectable()
export class SettlementPlugin implements BrainPlugin {
  id = 'builtin:settlement';
  name = '结算管理';
  type = 'builtin' as const;

  constructor(private readonly settlementService: SettlementService) {}

  get tools(): BrainTool[] {
    return [
      {
        name: 'settlement_list',
        description: '列出当前项目的所有结算记录，包括结算时间和明细',
        inputSchema: { type: 'object', properties: {} },
        call: async (_input: Record<string, unknown>, ctx: BrainToolContext) => {
          const settlements = await this.settlementService.findForProject(
            ctx.tenantId,
            ctx.projectId,
          );
          return settlements.map((s) => ({
            id: s.id,
            roundNumber: s.roundNumber,
            summary: s.summary,
            settledTaskIds: s.settledTaskIds,
            createdAt: s.createdAt,
          }));
        },
      },
      {
        name: 'settlement_trigger',
        description:
          '⚠️ 真实操作：触发项目结算。将扫描所有已关闭评审会议中未结算的任务，计算并发放工分。操作不可撤销，请确认用户意图后再调用。',
        inputSchema: { type: 'object', properties: {} },
        requiredPermission: { resource: 'settlements', action: 'trigger' },
        call: async (_input: Record<string, unknown>, ctx: BrainToolContext) => {
          const settlement = await this.settlementService.settleProject(
            ctx.projectId,
            ctx.tenantId,
            ctx.userId,
          );
          return {
            id: settlement.id,
            roundNumber: settlement.roundNumber,
            message: '结算已完成',
          };
        },
      },
    ];
  }

  async initialize(): Promise<void> {}
  async destroy(): Promise<void> {}
}
