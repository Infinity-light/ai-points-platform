import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FeishuBitableBinding } from '../feishu/entities/feishu-bitable-binding.entity';
import { FeishuBitableRecord } from '../feishu/entities/feishu-bitable-record.entity';
import { FeishuClientService } from '../feishu/feishu-client.service';
import { BitableSyncRegistryService, type BitableSyncAdapter } from './bitable-sync-registry.service';

const RATE_LIMIT_MS = 200;
const BATCH_SIZE = 500;
const MAX_RETRIES = 3;

interface UpsertRecordOpts {
  bindingId: string;
  feishuRecordId: string;
  entityType: string;
  entityId?: string;
}

@Injectable()
export class BatchSyncerService {
  private readonly logger = new Logger(BatchSyncerService.name);

  constructor(
    private readonly registry: BitableSyncRegistryService,
    @InjectRepository(FeishuBitableRecord)
    private readonly recordRepo: Repository<FeishuBitableRecord>,
    private readonly feishuClientService: FeishuClientService,
  ) {}

  async pushAll(
    binding: FeishuBitableBinding,
    tenantId: string,
  ): Promise<{ created: number; updated: number }> {
    const adapter = this.registry.get(binding.entityType);
    if (!adapter) {
      this.logger.warn(`pushAll: 未找到 adapter for entityType=${binding.entityType}`);
      return { created: 0, updated: 0 };
    }

    const entities = await adapter.findAllEntities(tenantId, binding.projectId);
    this.logger.log(`pushAll: entityType=${binding.entityType}, 共 ${entities.length} 条记录`);

    let created = 0;
    let updated = 0;

    for (let i = 0; i < entities.length; i += BATCH_SIZE) {
      const batch = entities.slice(i, i + BATCH_SIZE);
      for (const entity of batch) {
        try {
          const result = await this.withRetry(() =>
            this.pushSingleEntity(binding, tenantId, entity, adapter),
          );
          if (result === 'created') created++;
          else updated++;
        } catch (err) {
          this.logger.warn(
            `pushAll: 推送实体失败 entityType=${binding.entityType}, ${String(err)}`,
          );
        }
        await this.delay(RATE_LIMIT_MS);
      }
    }

    return { created, updated };
  }

  async pullAll(
    binding: FeishuBitableBinding,
    tenantId: string,
  ): Promise<{ created: number; updated: number; total: number }> {
    const adapter = this.registry.get(binding.entityType);
    if (!adapter) {
      this.logger.warn(`pullAll: 未找到 adapter for entityType=${binding.entityType}`);
      return { created: 0, updated: 0, total: 0 };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = await this.feishuClientService.getClient(tenantId) as any;
    let created = 0;
    let updated = 0;
    let total = 0;
    let pageToken: string | undefined;

    do {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const listRes: any = await this.withRetry(() =>
        client.bitable.appTableRecord.list({
          path: { app_token: binding.appToken, table_id: binding.tableId },
          params: { page_size: 100, ...(pageToken ? { page_token: pageToken } : {}) },
        }),
      );

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const records: any[] = listRes?.data?.items ?? [];
      pageToken = listRes?.data?.page_token as string | undefined;

      for (const record of records) {
        total++;
        const recordId: string = record.record_id as string;
        const fields: Record<string, unknown> = record.fields ?? {};

        try {
          const convertedData = adapter.fromFeishuRecord(fields, binding.fieldMapping);
          const { id: entityId, isNew } = await adapter.upsertFromFeishu(
            tenantId,
            binding.projectId,
            { ...convertedData, feishuRecordId: recordId },
          );

          await this.upsertBitableRecord({
            bindingId: binding.id,
            feishuRecordId: recordId,
            entityType: binding.entityType,
            entityId,
          });

          if (isNew) created++;
          else updated++;
        } catch (err) {
          this.logger.warn(`pullAll: 处理记录失败 recordId=${recordId}, ${String(err)}`);
        }

        await this.delay(RATE_LIMIT_MS);
      }
    } while (pageToken);

    return { created, updated, total };
  }

  async pushOne(
    binding: FeishuBitableBinding,
    tenantId: string,
    entityId: string,
  ): Promise<void> {
    const adapter = this.registry.get(binding.entityType);
    if (!adapter) {
      this.logger.warn(`pushOne: 未找到 adapter for entityType=${binding.entityType}`);
      return;
    }

    const entity = await adapter.findEntity(tenantId, entityId);
    if (!entity) {
      this.logger.warn(`pushOne: 未找到实体 entityType=${binding.entityType}, id=${entityId}`);
      return;
    }

    await this.withRetry(() => this.pushSingleEntity(binding, tenantId, entity, adapter));
  }

  async upsertBitableRecord(opts: UpsertRecordOpts): Promise<void> {
    const existing = await this.recordRepo.findOne({
      where: { bindingId: opts.bindingId, feishuRecordId: opts.feishuRecordId },
    });

    if (existing) {
      existing.entityType = opts.entityType;
      if (opts.entityId) existing.entityId = opts.entityId;
      existing.lastSyncAt = new Date();
      await this.recordRepo.save(existing);
      return;
    }

    const record = this.recordRepo.create({
      bindingId: opts.bindingId,
      feishuRecordId: opts.feishuRecordId,
      entityType: opts.entityType,
      entityId: opts.entityId ?? null,
      lastSyncAt: new Date(),
      taskId: null,
    });
    await this.recordRepo.save(record);
  }

  private async pushSingleEntity(
    binding: FeishuBitableBinding,
    tenantId: string,
    entity: unknown,
    adapter: BitableSyncAdapter,
  ): Promise<'created' | 'updated'> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entityId: string = (entity as any).id as string;
    const fields = adapter.toFeishuRecord(entity, binding.fieldMapping);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = await this.feishuClientService.getClient(tenantId) as any;

    const existingRecord = await this.recordRepo.findOne({
      where: { bindingId: binding.id, entityId, entityType: binding.entityType },
    });

    if (existingRecord?.feishuRecordId) {
      await client.bitable.appTableRecord.update({
        path: {
          app_token: binding.appToken,
          table_id: binding.tableId,
          record_id: existingRecord.feishuRecordId,
        },
        data: { fields },
      });
      existingRecord.lastSyncAt = new Date();
      await this.recordRepo.save(existingRecord);
      return 'updated';
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const createRes: any = await client.bitable.appTableRecord.create({
      path: { app_token: binding.appToken, table_id: binding.tableId },
      data: { fields },
    });

    const newRecordId: string = createRes?.data?.record?.record_id ?? '';
    if (newRecordId) {
      await this.upsertBitableRecord({
        bindingId: binding.id,
        feishuRecordId: newRecordId,
        entityType: binding.entityType,
        entityId,
      });
    }

    return 'created';
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async withRetry<T>(fn: () => Promise<T>, maxRetries = MAX_RETRIES): Promise<T> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastError = err;
        if (attempt < maxRetries) {
          const backoffMs = Math.pow(2, attempt - 1) * 500;
          this.logger.warn(`withRetry: 第 ${attempt} 次失败，${backoffMs}ms 后重试 — ${String(err)}`);
          await this.delay(backoffMs);
        }
      }
    }
    throw lastError;
  }
}
