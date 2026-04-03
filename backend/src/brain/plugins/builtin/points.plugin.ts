import { Injectable } from '@nestjs/common';
import {
  BrainPlugin,
  BrainTool,
  BrainToolContext,
} from '../../interfaces/brain-plugin.interface';
import { PointsService } from '../../../points/points.service';

@Injectable()
export class PointsPlugin implements BrainPlugin {
  id = 'builtin:points';
  name = '工分查询';
  type = 'builtin' as const;

  constructor(private readonly pointsService: PointsService) {}

  get tools(): BrainTool[] {
    return [
      {
        name: 'points_table',
        description:
          '获取当前项目的工分排行表，包含每个成员的活跃工分、历史工分和占比',
        inputSchema: { type: 'object', properties: {} },
        call: async (_input: Record<string, unknown>, ctx: BrainToolContext) => {
          return this.pointsService.getProjectPointsTable(
            ctx.tenantId,
            ctx.projectId,
          );
        },
      },
      {
        name: 'points_my_summary',
        description:
          '获取当前用户的工分概览：总工分、活跃工分、本月新增工分',
        inputSchema: { type: 'object', properties: {} },
        call: async (_input: Record<string, unknown>, ctx: BrainToolContext) => {
          return this.pointsService.getMySummary(ctx.tenantId, ctx.userId);
        },
      },
    ];
  }

  async initialize(): Promise<void> {}
  async destroy(): Promise<void> {}
}
