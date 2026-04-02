import { Processor, Process, OnQueueFailed, OnQueueCompleted } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { QUEUE_NAMES } from '../queue/queue.constants';
import { FeishuSyncService } from './feishu-sync.service';

export const FEISHU_FULL_SYNC_JOB = 'full-sync';

export interface FeishuSyncJobData {
  tenantId: string;
}

@Processor(QUEUE_NAMES.FEISHU_SYNC)
export class FeishuSyncProcessor {
  private readonly logger = new Logger(FeishuSyncProcessor.name);

  constructor(private readonly feishuSyncService: FeishuSyncService) {}

  @Process(FEISHU_FULL_SYNC_JOB)
  async handleFullSync(job: Job<FeishuSyncJobData>): Promise<void> {
    const { tenantId } = job.data;
    this.logger.log(`开始飞书全量同步: tenantId=${tenantId}`);

    const result = await this.feishuSyncService.syncAll(tenantId);
    this.logger.log(`飞书全量同步完成: status=${result.status}, stats=${JSON.stringify(result.stats)}`);
  }

  @OnQueueCompleted()
  onCompleted(job: Job): void {
    this.logger.log(`飞书同步任务 ${job.id} 完成`);
  }

  @OnQueueFailed()
  onFailed(job: Job, error: Error): void {
    this.logger.error(`飞书同步任务 ${job.id} 失败: ${error.message}`, error.stack);
  }
}
