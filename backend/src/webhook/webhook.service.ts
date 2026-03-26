import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { WebhookLog } from './entities/webhook-log.entity';
import { TaskService } from '../task/task.service';
import { SubmissionService } from '../submission/submission.service';
import { SubmissionType } from '../submission/entities/submission.entity';
import { QUEUE_NAMES } from '../queue/queue.constants';
import { TaskStatus } from '../task/enums/task-status.enum';

export interface CommitData {
  tenantId: string;
  taskId: string;  // parsed from commit message (this is the task's UUID or short ref)
  commitHash: string;
  commitMessage: string;
  repoUrl: string;
  commitUrl: string;
}

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    @InjectRepository(WebhookLog)
    private readonly webhookLogRepository: Repository<WebhookLog>,
    private readonly taskService: TaskService,
    private readonly submissionService: SubmissionService,
    @InjectQueue(QUEUE_NAMES.AI_REVIEW)
    private readonly aiReviewQueue: Queue,
  ) {}

  /**
   * Extract task IDs from commit message.
   * Patterns: #TASK-<uuid>, #TASK-<short-id>
   * Examples: "fix auth #TASK-abc12345", "完成登录功能 #TASK-550e8400-e29b-41d4-a716-446655440000"
   */
  extractTaskIds(commitMessage: string): string[] {
    const pattern = /#TASK-([a-fA-F0-9-]{8,36})/gi;
    const matches = [...commitMessage.matchAll(pattern)];
    return [...new Set(matches.map((m) => m[1]))]; // deduplicate
  }

  async processCommit(data: CommitData): Promise<void> {
    // Log the webhook
    const log = this.webhookLogRepository.create({
      tenantId: data.tenantId,
      taskId: data.taskId,
      commitHash: data.commitHash,
      commitMessage: data.commitMessage,
      repoUrl: data.repoUrl,
      commitUrl: data.commitUrl,
      status: 'processing',
    });
    const savedLog = await this.webhookLogRepository.save(log);

    try {
      // Find the task
      const task = await this.taskService.findOne(data.taskId, data.tenantId);

      if (task.status !== TaskStatus.CLAIMED) {
        this.logger.warn(`Task ${data.taskId} is not in CLAIMED state, skipping webhook commit`);
        await this.webhookLogRepository.update(savedLog.id, {
          status: 'skipped',
          note: `Task status is ${task.status}`,
        });
        return;
      }

      if (!task.assigneeId) {
        this.logger.warn(`Task ${data.taskId} has no assignee`);
        await this.webhookLogRepository.update(savedLog.id, {
          status: 'skipped',
          note: 'No assignee',
        });
        return;
      }

      // Create submission of type ai-exec
      await this.submissionService.create(task.tenantId, task.assigneeId, {
        taskId: task.id,
        type: SubmissionType.AI_EXEC,
        content: data.commitMessage,
        metadata: {
          commitHash: data.commitHash,
          repoUrl: data.repoUrl,
          commitUrl: data.commitUrl,
        },
      });

      await this.webhookLogRepository.update(savedLog.id, { status: 'completed' });
      this.logger.log(`Webhook processed: task ${data.taskId} commit ${data.commitHash.slice(0, 8)}`);
    } catch (err) {
      await this.webhookLogRepository.update(savedLog.id, {
        status: 'failed',
        note: String(err),
      });
      throw err;
    }
  }
}
