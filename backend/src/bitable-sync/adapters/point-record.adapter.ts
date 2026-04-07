import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PointRecord } from '../../points/entities/point-record.entity';
import { BitableSyncAdapter, FieldDefinition } from '../bitable-sync-registry.service';
import { BitableFieldMapping } from '../../feishu/entities/feishu-bitable-binding.entity';

@Injectable()
export class PointRecordBitableAdapter implements BitableSyncAdapter {
  entityType = 'point_record';
  defaultSyncDirection = 'push_only' as const;

  constructor(
    @InjectRepository(PointRecord)
    private readonly pointRecordRepo: Repository<PointRecord>,
  ) {}

  getDefaultFieldMappings(): Record<string, FieldDefinition> {
    return {
      userId: { feishuFieldName: '用户ID', feishuFieldType: 1, platformField: 'userId' },
      projectId: {
        feishuFieldName: '项目ID',
        feishuFieldType: 1,
        platformField: 'projectId',
      },
      originalPoints: {
        feishuFieldName: '原始工分',
        feishuFieldType: 2,
        platformField: 'originalPoints',
      },
      acquiredRound: {
        feishuFieldName: '获得轮次',
        feishuFieldType: 2,
        platformField: 'acquiredRound',
      },
      source: { feishuFieldName: '来源类型', feishuFieldType: 3, platformField: 'source' },
      taskId: { feishuFieldName: '任务ID', feishuFieldType: 1, platformField: 'taskId' },
      poolStatus: {
        feishuFieldName: '奖池状态',
        feishuFieldType: 3,
        platformField: 'poolStatus',
      },
      createdAt: { feishuFieldName: '创建时间', feishuFieldType: 5, platformField: 'createdAt' },
    };
  }

  toFeishuRecord(entity: unknown, fieldMapping: BitableFieldMapping): Record<string, unknown> {
    const record = entity as PointRecord;
    const fields: Record<string, unknown> = {};

    if (fieldMapping['userId']) {
      fields[fieldMapping['userId']] = record.userId;
    }

    if (fieldMapping['projectId']) {
      fields[fieldMapping['projectId']] = record.projectId;
    }

    if (fieldMapping['originalPoints']) {
      fields[fieldMapping['originalPoints']] = record.originalPoints;
    }

    if (fieldMapping['acquiredRound']) {
      fields[fieldMapping['acquiredRound']] = record.acquiredRound;
    }

    if (fieldMapping['source']) {
      fields[fieldMapping['source']] = record.source;
    }

    if (fieldMapping['taskId'] && record.taskId) {
      fields[fieldMapping['taskId']] = record.taskId;
    }

    if (fieldMapping['poolStatus']) {
      fields[fieldMapping['poolStatus']] = record.poolStatus;
    }

    if (fieldMapping['createdAt']) {
      fields[fieldMapping['createdAt']] = record.createdAt.getTime();
    }

    return fields;
  }

  fromFeishuRecord(
    _fields: Record<string, unknown>,
    _fieldMapping: BitableFieldMapping,
  ): Record<string, unknown> {
    throw new BadRequestException('PointRecord 适配器为只推送模式，不支持从飞书拉取数据');
  }

  async findEntity(tenantId: string, id: string): Promise<PointRecord | null> {
    return this.pointRecordRepo.findOne({ where: { id, tenantId } });
  }

  async findAllEntities(tenantId: string, projectId: string): Promise<PointRecord[]> {
    if (!projectId) {
      return this.pointRecordRepo.find({ where: { tenantId } });
    }
    return this.pointRecordRepo.find({ where: { tenantId, projectId } });
  }

  async upsertFromFeishu(
    _tenantId: string,
    _projectId: string,
    _data: Record<string, unknown>,
  ): Promise<{ id: string; isNew: boolean }> {
    throw new BadRequestException('PointRecord 适配器为只推送模式，不支持从飞书写入数据');
  }
}
