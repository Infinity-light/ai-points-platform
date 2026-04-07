import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { FeishuBitableBinding } from '../feishu/entities/feishu-bitable-binding.entity';
import type {
  SyncDirection,
  ConflictStrategy,
  BitableFieldMapping,
} from '../feishu/entities/feishu-bitable-binding.entity';
import { BitableSyncLog } from './entities/bitable-sync-log.entity';
import { BitableSyncRegistryService } from './bitable-sync-registry.service';
import { BatchSyncerService } from './batch-syncer.service';
import { QUEUE_NAMES } from '../queue/queue.constants';

export interface CreateBindingDto {
  projectId: string;
  appToken: string;
  tableId: string;
  entityType?: string;
  syncDirection?: SyncDirection;
  conflictStrategy?: ConflictStrategy;
  fieldMapping?: BitableFieldMapping;
  writebackFieldId?: string | null;
}

export interface UpdateBindingDto {
  appToken?: string;
  tableId?: string;
  entityType?: string;
  syncDirection?: SyncDirection;
  conflictStrategy?: ConflictStrategy;
  fieldMapping?: BitableFieldMapping;
  writebackFieldId?: string | null;
  isActive?: boolean;
}

@Injectable()
export class BitableSyncService {
  private readonly logger = new Logger(BitableSyncService.name);

  constructor(
    private readonly registry: BitableSyncRegistryService,
    private readonly batchSyncer: BatchSyncerService,
    @InjectRepository(FeishuBitableBinding)
    private readonly bindingRepo: Repository<FeishuBitableBinding>,
    @InjectRepository(BitableSyncLog)
    private readonly logRepo: Repository<BitableSyncLog>,
    @InjectQueue(QUEUE_NAMES.BITABLE_SYNC)
    private readonly syncQueue: Queue,
  ) {}

  // ─── Binding CRUD ─────────────────────────────────────────────────────────────

  async createBinding(tenantId: string, data: CreateBindingDto): Promise<FeishuBitableBinding> {
    const entityType = data.entityType ?? 'task';

    const binding = this.bindingRepo.create({
      tenantId,
      projectId: data.projectId,
      appToken: data.appToken,
      tableId: data.tableId,
      entityType,
      syncDirection: data.syncDirection ?? 'bidirectional',
      conflictStrategy: data.conflictStrategy ?? 'last_write_wins',
      fieldMapping: data.fieldMapping ?? {},
      writebackFieldId: data.writebackFieldId ?? null,
      syncStatus: 'idle',
      isActive: true,
    });

    const saved = await this.bindingRepo.save(binding);
    this.logger.log(
      `createBinding: 创建 binding id=${saved.id} projectId=${data.projectId} entityType=${entityType}`,
    );
    return saved;
  }

  async listBindings(tenantId: string): Promise<FeishuBitableBinding[]> {
    return this.bindingRepo.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });
  }

  async updateBinding(
    id: string,
    tenantId: string,
    data: UpdateBindingDto,
  ): Promise<FeishuBitableBinding> {
    const binding = await this.bindingRepo.findOne({ where: { id, tenantId } });
    if (!binding) {
      throw new NotFoundException(`Bitable binding ${id} 不存在`);
    }

    if (data.appToken !== undefined) binding.appToken = data.appToken;
    if (data.tableId !== undefined) binding.tableId = data.tableId;
    if (data.entityType !== undefined) binding.entityType = data.entityType;
    if (data.syncDirection !== undefined) binding.syncDirection = data.syncDirection;
    if (data.conflictStrategy !== undefined) binding.conflictStrategy = data.conflictStrategy;
    if (data.fieldMapping !== undefined) binding.fieldMapping = data.fieldMapping;
    if (data.writebackFieldId !== undefined) binding.writebackFieldId = data.writebackFieldId;
    if (data.isActive !== undefined) binding.isActive = data.isActive;

    return this.bindingRepo.save(binding);
  }

  async deleteBinding(id: string, tenantId: string): Promise<void> {
    const binding = await this.bindingRepo.findOne({ where: { id, tenantId } });
    if (!binding) {
      throw new NotFoundException(`Bitable binding ${id} 不存在`);
    }
    await this.bindingRepo.remove(binding);
    this.logger.log(`deleteBinding: 已删除 binding id=${id}`);
  }

  // ─── Sync operations ──────────────────────────────────────────────────────────

  async triggerFullSync(bindingId: string, tenantId: string): Promise<void> {
    const binding = await this.bindingRepo.findOne({
      where: { id: bindingId, tenantId },
    });
    if (!binding) {
      throw new NotFoundException(`Bitable binding ${bindingId} 不存在`);
    }

    await this.syncQueue.add('full-sync', { bindingId, tenantId });
    this.logger.log(`triggerFullSync: 已入队 bindingId=${bindingId}`);
  }

  async pushEntity(
    entityType: string,
    tenantId: string,
    projectId: string,
    entityId: string,
  ): Promise<void> {
    const binding = await this.bindingRepo.findOne({
      where: { tenantId, projectId, entityType, isActive: true },
    });

    if (!binding) {
      this.logger.debug(
        `pushEntity: 未找到 active binding for entityType=${entityType} projectId=${projectId}`,
      );
      return;
    }

    if (binding.syncDirection === 'pull_only') {
      this.logger.debug(`pushEntity: binding ${binding.id} 为 pull_only，跳过 push`);
      return;
    }

    await this.batchSyncer.pushOne(binding, tenantId, entityId);
  }

  // ─── Sync logs ────────────────────────────────────────────────────────────────

  async getSyncLogs(bindingId: string, tenantId: string): Promise<BitableSyncLog[]> {
    return this.logRepo.find({
      where: { bindingId, tenantId },
      order: { startedAt: 'DESC' },
      take: 50,
    });
  }
}
