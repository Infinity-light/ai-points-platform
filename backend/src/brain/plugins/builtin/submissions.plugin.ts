import { Injectable } from '@nestjs/common';
import {
  BrainPlugin,
  BrainTool,
  BrainToolContext,
} from '../../interfaces/brain-plugin.interface';
import { SubmissionService } from '../../../submission/submission.service';

@Injectable()
export class SubmissionsPlugin implements BrainPlugin {
  id = 'builtin:submissions';
  name = '提交记录';
  type = 'builtin' as const;

  constructor(private readonly submissionService: SubmissionService) {}

  get tools(): BrainTool[] {
    return [
      {
        name: 'submission_list_by_task',
        description:
          '查看某个任务的所有提交记录，包括提交内容、类型和 AI 审核状态',
        inputSchema: {
          type: 'object',
          properties: {
            taskId: { type: 'string', description: '任务 ID' },
          },
          required: ['taskId'],
        },
        call: async (input: Record<string, unknown>, ctx: BrainToolContext) => {
          const submissions = await this.submissionService.findByTask(
            input.taskId as string,
            ctx.tenantId,
          );
          return submissions.map((s) => ({
            id: s.id,
            type: s.type,
            content: s.content,
            aiReviewStatus: s.aiReviewStatus,
            createdAt: s.createdAt,
          }));
        },
      },
    ];
  }

  async initialize(): Promise<void> {}
  async destroy(): Promise<void> {}
}
