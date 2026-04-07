import { Processor, Process, OnQueueCompleted, OnQueueFailed } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Job } from 'bull';
import { FeishuBitableBinding } from '../feishu/entities/feishu-bitable-binding.entity';
import { FeishuBitableRecord } from '../feishu/entities/feishu-bitable-record.entity';
import { FeishuClientService } from '../feishu/feishu-client.service';
import { BitableSyncLog } from './entities/bitable-sync-log.entity';
import type { SyncLogDirection } from './entities/bitable-sync-log.entity';
import { BitableSyncRegistryService } from './bitable-sync-registry.service';
import { BatchSyncerService } from './batch-syncer.service';
import { QUEUE_NAMES } from '../queue/queue.constants';

interface FullSyncJobData {
  bindingId: string;
  tenantId: string;
}

interface RecordSyncJobData {
  bindingId: string;
  tenantId: string;
  recordId: string;
  eventId?: string;
}

@Processor(QUEUE_NAMES.BITABLE_SYNC)
export class BitableSyncProcessor {
  private readonly logger = new Logger(BitableSyncProcessor.name);

  constructor(
    private readonly batchSyncer: BatchSyncerService,
    private readonly registry: BitableSyncRegistryService,
    @InjectRepository(FeishuBitableBinding)
    private readonly bindingRepo: Repository<FeishuBitableBinding>,
    @InjectRepository(FeishuBitableRecord)
    private readonly recordRepo: Repository<FeishuBitableRecord>,
    @InjectRepository(BitableSyncLog)
    private readonly logRepo: Repository<BitableSyncLog>,
    private readonly feishuClientService: FeishuClientService,
  ) {}

  @Process('full-sync')
  async handleFullSync(job: Job<FullSyncJobData>): Promise<void> {
    const { bindingId, tenantId } = job.data;
    this.logger.log(`[full-sync] 开始: bindingId=${bindingId}, tenantId=${tenantId}`);

    const binding = await this.bindingRepo.findOne({ where: { id: bindingId, tenantId } });
    if (!binding) {
      this.logger.warn(`[full-sync] Binding ${bindingId} 不存在，跳过`);
      return;
    }

    // Determine sync direction for logging
    const direction: SyncLogDirection =
      binding.syncDirection === 'push_only'
        ? 'platform_to_feishu'
        : binding.syncDirection === 'pull_only'
        ? 'feishu_to_platform'
        : 'platform_to_feishu'; // bidirectional: push first, then pull

    // Create sync log
    const syncLog = this.logRepo.create({
      tenantId,
      bindingId,
      syncType: 'full',
      direction,
      status: 'running',
      startedAt: new Date(),
    });
    await this.logRepo.save(syncLog);

    let recordsCreated = 0;
    let recordsUpdated = 0;
    let recordsFailed = 0;

    try {
      if (binding.syncDirection !== 'pull_only') {
        const pushResult = await this.batchSyncer.pushAll(binding, tenantId);
        recordsCreated += pushResult.created;
        recordsUpdated += pushResult.updated;
      }

      if (binding.syncDirection !== 'push_only') {
        const pullResult = await this.batchSyncer.pullAll(binding, tenantId);
        recordsCreated += pullResult.created;
        recordsUpdated += pullResult.updated;
      }

      syncLog.status = 'completed';
      syncLog.recordsProcessed = recordsCreated + recordsUpdated + recordsFailed;
      syncLog.recordsCreated = recordsCreated;
      syncLog.recordsUpdated = recordsUpdated;
      syncLog.recordsFailed = recordsFailed;
      syncLog.completedAt = new Date();
      await this.logRepo.save(syncLog);

      this.logger.log(
        `[full-sync] 完成: bindingId=${bindingId}, created=${recordsCreated}, updated=${recordsUpdated}`,
      );
    } catch (err) {
      const errMsg = String(err);
      syncLog.status = 'failed';
      syncLog.errorMessage = errMsg;
      syncLog.completedAt = new Date();
      await this.logRepo.save(syncLog);

      this.logger.error(`[full-sync] 失败: bindingId=${bindingId}, ${errMsg}`);
      throw err;
    }
  }

  @Process('record-sync')
  async handleRecordSync(job: Job<RecordSyncJobData>): Promise<void> {
    const { bindingId, tenantId, recordId, eventId } = job.data;
    this.logger.debug(
      `[record-sync] 处理: bindingId=${bindingId}, recordId=${recordId}`,
    );

    const binding = await this.bindingRepo.findOne({ where: { id: bindingId, tenantId } });
    if (!binding) {
      this.logger.warn(`[record-sync] Binding ${bindingId} 不存在，跳过`);
      return;
    }

    const adapter = this.registry.get(binding.entityType);
    if (!adapter) {
      this.logger.warn(`[record-sync] 未找到 adapter for entityType=${binding.entityType}`);
      return;
    }

    // Create sync log
    const syncLog = this.logRepo.create({
      tenantId,
      bindingId,
      syncType: 'webhook',
      direction: 'feishu_to_platform',
      status: 'running',
      startedAt: new Date(),
    });
    await this.logRepo.save(syncLog);

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = await this.feishuClientService.getClient(tenantId) as any;
      const res = await client.bitable.appTableRecord.get({
        path: {
          app_token: binding.appToken,
          table_id: binding.tableId,
          record_id: recordId,
        },
      });

      const fields: Record<string, unknown> = res?.data?.record?.fields ?? {};
      const convertedData = adapter.fromFeishuRecord(fields, binding.fieldMapping);

      await adapter.upsertFromFeishu(tenantId, binding.projectId, {
        ...convertedData,
        feishuRecordId: recordId,
      });

      // Update record tracking with eventId for idempotency
      await this.batchSyncer.upsertBitableRecord({
        bindingId: binding.id,
        feishuRecordId: recordId,
        entityType: binding.entityType,
      });
      // Stamp the eventId separately so future webhooks with the same eventId are skipped
      if (eventId) {
        const trackedRecord = await this.recordRepo.findOne({
          where: { bindingId: binding.id, feishuRecordId: recordId },
        });
        if (trackedRecord) {
          trackedRecord.lastEventId = eventId;
          await this.recordRepo.save(trackedRecord);
        }
      }

      syncLog.status = 'completed';
      syncLog.recordsProcessed = 1;
      syncLog.recordsUpdated = 1;
      syncLog.completedAt = new Date();
      await this.logRepo.save(syncLog);

      this.logger.debug(
        `[record-sync] 完成: bindingId=${bindingId}, recordId=${recordId}`,
      );
    } catch (err) {
      const errMsg = String(err);
      syncLog.status = 'failed';
      syncLog.recordsFailed = 1;
      syncLog.errorMessage = errMsg;
      syncLog.completedAt = new Date();
      await this.logRepo.save(syncLog);

      this.logger.error(`[record-sync] 失败: recordId=${recordId}, ${errMsg}`);
      throw err;
    }
  }

  @OnQueueCompleted()
  onCompleted(job: Job): void {
    this.logger.log(`Bitable 同步任务 ${job.id} (${job.name}) 完成`);
  }

  @OnQueueFailed()
  onFailed(job: Job, error: Error): void {
    this.logger.error(
      `Bitable 同步任务 ${job.id} (${job.name}) 失败: ${error.message}`,
      error.stack,
    );
  }
}
