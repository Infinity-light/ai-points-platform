import { Processor, Process, OnQueueFailed, OnQueueCompleted } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { QUEUE_NAMES } from '../queue.constants';
import { AiService } from '../../ai/ai.service';
import { TaskService } from '../../task/task.service';

export const AI_REVIEW_JOB_NAMES = {
  REVIEW_SUBMISSION: 'review-submission',
} as const;

export interface AiReviewJobData {
  submissionId: string;
  taskId: string;
  tenantId: string;
  taskTitle: string;
  taskDescription: string | null;
  submissionContent: string;
  submissionType: 'explore' | 'ai-exec' | 'manual';
}

@Processor(QUEUE_NAMES.AI_REVIEW)
export class AiReviewProcessor {
  private readonly logger = new Logger(AiReviewProcessor.name);

  constructor(
    private readonly aiService: AiService,
    private readonly taskService: TaskService,
  ) {}

  @Process(AI_REVIEW_JOB_NAMES.REVIEW_SUBMISSION)
  async handleReviewSubmission(job: Job<AiReviewJobData>): Promise<void> {
    const { taskId, tenantId, taskTitle, taskDescription, submissionContent, submissionType } = job.data;
    this.logger.log(`Starting AI review for task: ${taskId}`);

    try {
      const scores = await this.aiService.reviewSubmission({
        taskTitle,
        taskDescription,
        submissionContent,
        submissionType,
      });

      await this.taskService.updateAiScores(taskId, tenantId, scores);
      this.logger.log(`AI review complete for task ${taskId}: avg=${scores.average}`);
    } catch (error) {
      this.logger.error(`AI review failed for task ${taskId}: ${String(error)}`);
      throw error; // Let Bull retry
    }
  }

  @OnQueueCompleted()
  onCompleted(job: Job): void {
    this.logger.log(`Job ${job.id} completed`);
  }

  @OnQueueFailed()
  onFailed(job: Job, error: Error): void {
    this.logger.error(`Job ${job.id} failed: ${error.message}`, error.stack);
  }
}
