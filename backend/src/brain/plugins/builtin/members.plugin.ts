import { Injectable } from '@nestjs/common';
import {
  BrainPlugin,
  BrainTool,
  BrainToolContext,
} from '../../interfaces/brain-plugin.interface';
import { ProjectService } from '../../../project/project.service';

@Injectable()
export class MembersPlugin implements BrainPlugin {
  id = 'builtin:members';
  name = '成员查询';
  type = 'builtin' as const;

  constructor(private readonly projectService: ProjectService) {}

  get tools(): BrainTool[] {
    return [
      {
        name: 'members_list',
        description: '列出当前项目的所有成员，返回姓名、角色、加入时间',
        inputSchema: { type: 'object', properties: {} },
        call: async (_input: Record<string, unknown>, ctx: BrainToolContext) => {
          const members = await this.projectService.getMembers(
            ctx.projectId,
            ctx.tenantId,
          );
          return members.map((m) => ({
            userId: m.userId,
            projectRoleId: m.projectRoleId,
            joinedAt: m.joinedAt,
          }));
        },
      },
    ];
  }

  async initialize(): Promise<void> {}
  async destroy(): Promise<void> {}
}
