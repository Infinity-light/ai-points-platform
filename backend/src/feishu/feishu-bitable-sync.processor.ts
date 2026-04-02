import { Processor, Process, OnQueueCompleted, OnQueueFailed } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { QUEUE_NAMES } from '../queue/queue.constants';
import { FeishuBitableSyncService } from './feishu-bitable-sync.service';

export const BITABLE_FULL_SYNC_JOB = 'bitable-full-sync';

export interface BitableSyncJobData {
  bindingId: string;
  tenantId: string;
}

@Processor(QUEUE_NAMES.FEISHU_BITABLE_SYNC)
export class FeishuBitableSyncProcessor {
  private readonly logger = new Logger(FeishuBitableSyncProcessor.name);

  constructor(private readonly bitableSyncService: FeishuBitableSyncService) {}

  @Process(BITABLE_FULL_SYNC_JOB)
  async handleFullSync(job: Job<BitableSyncJobData>): Promise<void> {
    const { bindingId, tenantId } = job.data;
    this.logger.log(`开始 Bitable 全量同步: bindingId=${bindingId}, tenantId=${tenantId}`);

    const result = await this.bitableSyncService.fullSync(bindingId, tenantId);
    this.logger.log(
      `Bitable 全量同步完成: created=${result.created}, updated=${result.updated}, total=${result.total}`,
    );
  }

  @OnQueueCompleted()
  onCompleted(job: Job): void {
    this.logger.log(`Bitable 同步任务 ${job.id} 完成`);
  }

  @OnQueueFailed()
  onFailed(job: Job, error: Error): void {
    this.logger.error(`Bitable 同步任务 ${job.id} 失败: ${error.message}`, error.stack);
  }
}
