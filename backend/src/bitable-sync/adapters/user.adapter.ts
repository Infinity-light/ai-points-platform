import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { BitableSyncAdapter, FieldDefinition } from '../bitable-sync-registry.service';
import { BitableFieldMapping } from '../../feishu/entities/feishu-bitable-binding.entity';

@Injectable()
export class UserBitableAdapter implements BitableSyncAdapter {
  entityType = 'user';
  defaultSyncDirection = 'bidirectional' as const;

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  getDefaultFieldMappings(): Record<string, FieldDefinition> {
    return {
      name: { feishuFieldName: '姓名', feishuFieldType: 1, platformField: 'name' },
      email: { feishuFieldName: '邮箱', feishuFieldType: 1, platformField: 'email' },
      phone: { feishuFieldName: '手机号', feishuFieldType: 13, platformField: 'phone' },
      departmentId: {
        feishuFieldName: '部门ID',
        feishuFieldType: 1,
        platformField: 'departmentId',
      },
      feishuOpenId: {
        feishuFieldName: '飞书OpenID',
        feishuFieldType: 1,
        platformField: 'feishuOpenId',
      },
      isEmailVerified: {
        feishuFieldName: '邮箱已验证',
        feishuFieldType: 1,
        platformField: 'isEmailVerified',
      },
      createdAt: { feishuFieldName: '创建时间', feishuFieldType: 5, platformField: 'createdAt' },
    };
  }

  toFeishuRecord(entity: unknown, fieldMapping: BitableFieldMapping): Record<string, unknown> {
    const user = entity as User;
    const fields: Record<string, unknown> = {};

    if (fieldMapping['name']) {
      fields[fieldMapping['name']] = user.name;
    }

    if (fieldMapping['email']) {
      fields[fieldMapping['email']] = user.email;
    }

    if (fieldMapping['phone'] && user.phone) {
      fields[fieldMapping['phone']] = user.phone;
    }

    if (fieldMapping['departmentId'] && user.departmentId) {
      fields[fieldMapping['departmentId']] = user.departmentId;
    }

    if (fieldMapping['feishuOpenId'] && user.feishuOpenId) {
      fields[fieldMapping['feishuOpenId']] = user.feishuOpenId;
    }

    if (fieldMapping['isEmailVerified']) {
      fields[fieldMapping['isEmailVerified']] = String(user.isEmailVerified);
    }

    if (fieldMapping['createdAt']) {
      fields[fieldMapping['createdAt']] = user.createdAt.getTime();
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

    if (fieldMapping['email'] && fields[fieldMapping['email']] !== undefined) {
      data['email'] = extractTextValue(fields[fieldMapping['email']]);
    }

    if (fieldMapping['phone'] && fields[fieldMapping['phone']] !== undefined) {
      data['phone'] = extractTextValue(fields[fieldMapping['phone']]);
    }

    return data;
  }

  async findEntity(tenantId: string, id: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { id, tenantId } });
  }

  async findAllEntities(tenantId: string, _projectId: string): Promise<User[]> {
    return this.userRepo.find({ where: { tenantId } });
  }

  async upsertFromFeishu(
    tenantId: string,
    _projectId: string,
    data: Record<string, unknown>,
  ): Promise<{ id: string; isNew: boolean }> {
    const email = data['email'] as string | undefined;
    if (!email) {
      throw new Error('用户同步需要邮箱字段');
    }

    const existing = await this.userRepo.findOne({ where: { email, tenantId } });
    if (!existing) {
      // Skip: cannot create users from Feishu without auth setup
      throw new Error(`用户 ${email} 不存在于平台，跳过从飞书创建`);
    }

    if (data['name']) existing.name = data['name'] as string;
    if (data['phone'] !== undefined) {
      existing.phone = (data['phone'] as string) || null;
    }

    const saved = await this.userRepo.save(existing);
    return { id: saved.id, isNew: false };
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
