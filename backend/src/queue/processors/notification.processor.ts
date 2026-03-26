import { Processor, Process, OnQueueFailed } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { QUEUE_NAMES } from '../queue.constants';

export const NOTIFICATION_JOB_NAMES = {
  SEND_NOTIFICATION: 'send-notification',
} as const;

export interface NotificationJobData {
  userId: string;
  type: string;
  title: string;
  content: string;
  metadata?: Record<string, unknown>;
}

@Processor(QUEUE_NAMES.NOTIFICATION)
export class NotificationProcessor {
  private readonly logger = new Logger(NotificationProcessor.name);

  @Process(NOTIFICATION_JOB_NAMES.SEND_NOTIFICATION)
  async handleSendNotification(job: Job<NotificationJobData>): Promise<void> {
    this.logger.log(`Sending notification to user: ${job.data.userId}`);
    // 通知发送逻辑将在 T35（通知模块）中实现
  }

  @OnQueueFailed()
  onFailed(job: Job, error: Error): void {
    this.logger.error(`Notification job ${job.id} failed: ${error.message}`, error.stack);
  }
}
