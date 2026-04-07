import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Settlement } from '../../settlement/entities/settlement.entity';
import { BitableSyncAdapter, FieldDefinition } from '../bitable-sync-registry.service';
import { BitableFieldMapping } from '../../feishu/entities/feishu-bitable-binding.entity';

@Injectable()
export class SettlementBitableAdapter implements BitableSyncAdapter {
  entityType = 'settlement';
  defaultSyncDirection = 'push_only' as const;

  constructor(
    @InjectRepository(Settlement)
    private readonly settlementRepo: Repository<Settlement>,
  ) {}

  getDefaultFieldMappings(): Record<string, FieldDefinition> {
    return {
      projectId: {
        feishuFieldName: '项目ID',
        feishuFieldType: 1,
        platformField: 'projectId',
      },
      roundNumber: {
        feishuFieldName: '结算轮次',
        feishuFieldType: 2,
        platformField: 'roundNumber',
      },
      totalPointsAwarded: {
        feishuFieldName: '本轮发放工分',
        feishuFieldType: 2,
        platformField: 'totalPointsAwarded',
      },
      usersAffected: {
        feishuFieldName: '受益人数',
        feishuFieldType: 2,
        platformField: 'usersAffected',
      },
      settledTaskCount: {
        feishuFieldName: '结算任务数',
        feishuFieldType: 2,
        platformField: 'settledTaskCount',
      },
      triggeredBy: {
        feishuFieldName: '触发人ID',
        feishuFieldType: 1,
        platformField: 'triggeredBy',
      },
      settledAt: {
        feishuFieldName: '结算时间',
        feishuFieldType: 5,
        platformField: 'createdAt',
      },
    };
  }

  toFeishuRecord(entity: unknown, fieldMapping: BitableFieldMapping): Record<string, unknown> {
    const settlement = entity as Settlement;
    const fields: Record<string, unknown> = {};

    if (fieldMapping['projectId']) {
      fields[fieldMapping['projectId']] = settlement.projectId;
    }

    if (fieldMapping['roundNumber']) {
      fields[fieldMapping['roundNumber']] = settlement.roundNumber;
    }

    if (fieldMapping['totalPointsAwarded']) {
      fields[fieldMapping['totalPointsAwarded']] =
        settlement.summary?.totalPointsAwarded ?? 0;
    }

    if (fieldMapping['usersAffected']) {
      fields[fieldMapping['usersAffected']] = settlement.summary?.usersAffected ?? 0;
    }

    if (fieldMapping['settledTaskCount']) {
      fields[fieldMapping['settledTaskCount']] = settlement.settledTaskIds?.length ?? 0;
    }

    if (fieldMapping['triggeredBy']) {
      fields[fieldMapping['triggeredBy']] = settlement.triggeredBy;
    }

    if (fieldMapping['settledAt']) {
      fields[fieldMapping['settledAt']] = settlement.createdAt.getTime();
    }

    return fields;
  }

  fromFeishuRecord(
    _fields: Record<string, unknown>,
    _fieldMapping: BitableFieldMapping,
  ): Record<string, unknown> {
    throw new BadRequestException('Settlement 适配器为只推送模式，不支持从飞书拉取数据');
  }

  async findEntity(tenantId: string, id: string): Promise<Settlement | null> {
    return this.settlementRepo.findOne({ where: { id, tenantId } });
  }

  async findAllEntities(tenantId: string, projectId: string): Promise<Settlement[]> {
    if (!projectId) {
      return this.settlementRepo.find({ where: { tenantId } });
    }
    return this.settlementRepo.find({ where: { tenantId, projectId } });
  }

  async upsertFromFeishu(
    _tenantId: string,
    _projectId: string,
    _data: Record<string, unknown>,
  ): Promise<{ id: string; isNew: boolean }> {
    throw new BadRequestException('Settlement 适配器为只推送模式，不支持从飞书写入数据');
  }
}
