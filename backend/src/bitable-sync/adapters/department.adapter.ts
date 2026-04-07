import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Department } from '../../department/entities/department.entity';
import { BitableSyncAdapter, FieldDefinition } from '../bitable-sync-registry.service';
import { BitableFieldMapping } from '../../feishu/entities/feishu-bitable-binding.entity';

@Injectable()
export class DepartmentBitableAdapter implements BitableSyncAdapter {
  entityType = 'department';
  defaultSyncDirection = 'bidirectional' as const;

  constructor(
    @InjectRepository(Department)
    private readonly departmentRepo: Repository<Department>,
  ) {}

  getDefaultFieldMappings(): Record<string, FieldDefinition> {
    return {
      name: { feishuFieldName: '部门名称', feishuFieldType: 1, platformField: 'name' },
      feishuDeptId: {
        feishuFieldName: '飞书部门ID',
        feishuFieldType: 1,
        platformField: 'feishuDeptId',
      },
      parentId: {
        feishuFieldName: '父部门ID',
        feishuFieldType: 1,
        platformField: 'parentId',
      },
      memberCount: {
        feishuFieldName: '成员人数',
        feishuFieldType: 2,
        platformField: 'memberCount',
      },
      sortOrder: {
        feishuFieldName: '排序',
        feishuFieldType: 2,
        platformField: 'sortOrder',
      },
    };
  }

  toFeishuRecord(entity: unknown, fieldMapping: BitableFieldMapping): Record<string, unknown> {
    const dept = entity as Department;
    const fields: Record<string, unknown> = {};

    if (fieldMapping['name']) {
      fields[fieldMapping['name']] = dept.name;
    }

    if (fieldMapping['feishuDeptId'] && dept.feishuDeptId) {
      fields[fieldMapping['feishuDeptId']] = dept.feishuDeptId;
    }

    if (fieldMapping['parentId'] && dept.parentId) {
      fields[fieldMapping['parentId']] = dept.parentId;
    }

    if (fieldMapping['memberCount']) {
      fields[fieldMapping['memberCount']] = dept.memberCount;
    }

    if (fieldMapping['sortOrder']) {
      fields[fieldMapping['sortOrder']] = dept.sortOrder;
    }

    return fields;
  }

  fromFeishuRecord(
    fields: Record<string, unknown>,
    fieldMapping: BitableFieldMapping,
  ): Record<string, unknown> {
    const data: Record<string, unknown> = {};

    if (fieldMapping['name'] && fields[fieldMapping['name']] !== undefined) {
      data['name'] = extractTextValue(fields[fieldMapping['name']]);
    }

    if (fieldMapping['feishuDeptId'] && fields[fieldMapping['feishuDeptId']] !== undefined) {
      data['feishuDeptId'] = extractTextValue(fields[fieldMapping['feishuDeptId']]);
    }

    if (fieldMapping['memberCount'] && fields[fieldMapping['memberCount']] !== undefined) {
      const count = fields[fieldMapping['memberCount']];
      data['memberCount'] = typeof count === 'number' ? count : Number(count);
    }

    return data;
  }

  async findEntity(tenantId: string, id: string): Promise<Department | null> {
    return this.departmentRepo.findOne({ where: { id, tenantId } });
  }

  async findAllEntities(tenantId: string, _projectId: string): Promise<Department[]> {
    return this.departmentRepo.find({ where: { tenantId, isDeleted: false } });
  }

  async upsertFromFeishu(
    tenantId: string,
    _projectId: string,
    data: Record<string, unknown>,
  ): Promise<{ id: string; isNew: boolean }> {
    const feishuDeptId = data['feishuDeptId'] as string | undefined;

    if (feishuDeptId) {
      const existing = await this.departmentRepo.findOne({
        where: { tenantId, feishuDeptId },
      });

      if (existing) {
        if (data['name']) existing.name = data['name'] as string;
        if (data['memberCount'] !== undefined) {
          existing.memberCount = Number(data['memberCount']);
        }
        const saved = await this.departmentRepo.save(existing);
        return { id: saved.id, isNew: false };
      }
    }

    const name = (data['name'] as string | undefined) || '未命名部门';
    const dept = this.departmentRepo.create({
      tenantId,
      name,
      feishuDeptId: feishuDeptId ?? null,
      parentId: null,
      memberCount: Number(data['memberCount'] ?? 0),
      sortOrder: 0,
      isDeleted: false,
    });
    const saved = await this.departmentRepo.save(dept);
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
