import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Asset } from '../../asset/entities/asset.entity';
import { BitableSyncAdapter, FieldDefinition } from '../bitable-sync-registry.service';
import { BitableFieldMapping } from '../../feishu/entities/feishu-bitable-binding.entity';

const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000001';

@Injectable()
export class AssetBitableAdapter implements BitableSyncAdapter {
  entityType = 'asset';
  defaultSyncDirection = 'bidirectional' as const;

  constructor(
    @InjectRepository(Asset)
    private readonly assetRepo: Repository<Asset>,
  ) {}

  getDefaultFieldMappings(): Record<string, FieldDefinition> {
    return {
      assetCode: { feishuFieldName: '资产编号', feishuFieldType: 1, platformField: 'assetCode' },
      name: { feishuFieldName: '资产名称', feishuFieldType: 1, platformField: 'name' },
      assetType: {
        feishuFieldName: '资产类型',
        feishuFieldType: 3,
        platformField: 'assetType',
      },
      category: { feishuFieldName: '资产分类', feishuFieldType: 3, platformField: 'category' },
      status: { feishuFieldName: '资产状态', feishuFieldType: 3, platformField: 'status' },
      purchasePrice: {
        feishuFieldName: '购入价格',
        feishuFieldType: 2,
        platformField: 'purchasePrice',
      },
      vendor: { feishuFieldName: '供应商', feishuFieldType: 1, platformField: 'vendor' },
      assignedUserId: {
        feishuFieldName: '使用人ID',
        feishuFieldType: 1,
        platformField: 'assignedUserId',
      },
      purchaseDate: {
        feishuFieldName: '购入日期',
        feishuFieldType: 5,
        platformField: 'purchaseDate',
      },
      serialNumber: {
        feishuFieldName: '序列号',
        feishuFieldType: 1,
        platformField: 'serialNumber',
      },
      notes: { feishuFieldName: '备注', feishuFieldType: 1, platformField: 'notes' },
    };
  }

  toFeishuRecord(entity: unknown, fieldMapping: BitableFieldMapping): Record<string, unknown> {
    const asset = entity as Asset;
    const fields: Record<string, unknown> = {};

    if (fieldMapping['assetCode']) {
      fields[fieldMapping['assetCode']] = asset.assetCode;
    }

    if (fieldMapping['name']) {
      fields[fieldMapping['name']] = asset.name;
    }

    if (fieldMapping['assetType']) {
      fields[fieldMapping['assetType']] = asset.assetType;
    }

    if (fieldMapping['category']) {
      fields[fieldMapping['category']] = asset.category;
    }

    if (fieldMapping['status']) {
      fields[fieldMapping['status']] = asset.status;
    }

    if (fieldMapping['purchasePrice'] && asset.purchasePrice !== null) {
      fields[fieldMapping['purchasePrice']] = Number(asset.purchasePrice);
    }

    if (fieldMapping['vendor'] && asset.vendor) {
      fields[fieldMapping['vendor']] = asset.vendor;
    }

    if (fieldMapping['assignedUserId'] && asset.assignedUserId) {
      fields[fieldMapping['assignedUserId']] = asset.assignedUserId;
    }

    if (fieldMapping['purchaseDate'] && asset.purchaseDate) {
      const d = new Date(asset.purchaseDate);
      if (!isNaN(d.getTime())) {
        fields[fieldMapping['purchaseDate']] = d.getTime();
      }
    }

    if (fieldMapping['serialNumber'] && asset.serialNumber) {
      fields[fieldMapping['serialNumber']] = asset.serialNumber;
    }

    if (fieldMapping['notes'] && asset.notes) {
      fields[fieldMapping['notes']] = asset.notes;
    }

    return fields;
  }

  fromFeishuRecord(
    fields: Record<string, unknown>,
    fieldMapping: BitableFieldMapping,
  ): Record<string, unknown> {
    const data: Record<string, unknown> = {};

    if (fieldMapping['assetCode'] && fields[fieldMapping['assetCode']] !== undefined) {
      data['assetCode'] = extractTextValue(fields[fieldMapping['assetCode']]);
    }

    if (fieldMapping['name'] && fields[fieldMapping['name']] !== undefined) {
      data['name'] = extractTextValue(fields[fieldMapping['name']]);
    }

    if (fieldMapping['category'] && fields[fieldMapping['category']] !== undefined) {
      data['category'] = extractSelectValue(fields[fieldMapping['category']]);
    }

    if (fieldMapping['status'] && fields[fieldMapping['status']] !== undefined) {
      data['status'] = extractSelectValue(fields[fieldMapping['status']]);
    }

    if (fieldMapping['vendor'] && fields[fieldMapping['vendor']] !== undefined) {
      data['vendor'] = extractTextValue(fields[fieldMapping['vendor']]);
    }

    if (fieldMapping['notes'] && fields[fieldMapping['notes']] !== undefined) {
      data['notes'] = extractTextValue(fields[fieldMapping['notes']]);
    }

    if (fieldMapping['purchasePrice'] && fields[fieldMapping['purchasePrice']] !== undefined) {
      const price = fields[fieldMapping['purchasePrice']];
      data['purchasePrice'] = price !== null && price !== undefined ? Number(price) : null;
    }

    return data;
  }

  async findEntity(tenantId: string, id: string): Promise<Asset | null> {
    return this.assetRepo.findOne({ where: { id, tenantId } });
  }

  async findAllEntities(tenantId: string, _projectId: string): Promise<Asset[]> {
    return this.assetRepo.find({ where: { tenantId } });
  }

  async upsertFromFeishu(
    tenantId: string,
    _projectId: string,
    data: Record<string, unknown>,
  ): Promise<{ id: string; isNew: boolean }> {
    const assetCode = data['assetCode'] as string | undefined;
    const feishuRecordId = data['feishuRecordId'] as string | undefined;

    let asset: Asset | null = null;

    if (feishuRecordId) {
      asset = await this.assetRepo.findOne({ where: { feishuRecordId, tenantId } });
    }

    if (!asset && assetCode) {
      asset = await this.assetRepo.findOne({ where: { assetCode, tenantId } });
    }

    if (asset) {
      if (data['name']) asset.name = data['name'] as string;
      if (data['category']) asset.category = data['category'] as string;
      if (data['status']) asset.status = data['status'] as Asset['status'];
      if (data['vendor'] !== undefined) asset.vendor = (data['vendor'] as string) || null;
      if (data['notes'] !== undefined) asset.notes = (data['notes'] as string) || null;
      if (data['purchasePrice'] !== undefined) {
        asset.purchasePrice = data['purchasePrice'] !== null ? Number(data['purchasePrice']) : null;
      }
      if (feishuRecordId && !asset.feishuRecordId) {
        asset.feishuRecordId = feishuRecordId;
      }

      const saved = await this.assetRepo.save(asset);
      return { id: saved.id, isNew: false };
    }

    const name = (data['name'] as string | undefined) || '未命名资产';
    const code = assetCode || `FEISHU-${Date.now()}`;

    const newAsset = this.assetRepo.create({
      tenantId,
      assetCode: code,
      name,
      assetType: (data['assetType'] as Asset['assetType']) ?? 'physical',
      category: (data['category'] as string) ?? 'other',
      status: (data['status'] as Asset['status']) ?? 'pending_acceptance',
      purchasePrice:
        data['purchasePrice'] !== undefined && data['purchasePrice'] !== null
          ? Number(data['purchasePrice'])
          : null,
      vendor: (data['vendor'] as string) || null,
      notes: (data['notes'] as string) || null,
      feishuRecordId: feishuRecordId ?? null,
      createdBy: SYSTEM_USER_ID,
      metadata: {},
    });
    const saved = await this.assetRepo.save(newAsset);
    return { id: saved.id, isNew: true };
  }
}

function extractTextValue(fieldValue: unknown): string {
  if (fieldValue === null || fieldValue === undefined) return '';
  if (typeof fieldValue === 'string') return fieldValue;
  if (typeof fieldValue === 'number' || typeof fieldValue === 'boolean') return String(fieldValue);
  if (Array.isArray(fieldValue)) {
    return fieldValue
      .map((seg: unknown) => {
        if (typeof seg === 'string') return seg;
        if (typeof seg === 'number' || typeof seg === 'boolean') return String(seg);
        if (typeof seg === 'object' && seg !== null) {
          const text = (seg as Record<string, unknown>)['text'];
          return typeof text === 'string' ? text : '';
        }
        return '';
      })
      .join('');
  }
  if (typeof fieldValue === 'object') {
    const obj = fieldValue as Record<string, unknown>;
    const text = obj['text'];
    if (typeof text === 'string') return text;
    if (typeof text === 'number' || typeof text === 'boolean') return String(text);
  }
  return '';
}

function extractSelectValue(fieldValue: unknown): string {
  if (fieldValue === null || fieldValue === undefined) return '';
  if (typeof fieldValue === 'string') return fieldValue;
  if (typeof fieldValue === 'number' || typeof fieldValue === 'boolean') return String(fieldValue);
  if (typeof fieldValue === 'object') {
    const obj = fieldValue as Record<string, unknown>;
    const text = obj['text'];
    if (typeof text === 'string') return text;
    if (typeof text === 'number' || typeof text === 'boolean') return String(text);
  }
  return '';
}
