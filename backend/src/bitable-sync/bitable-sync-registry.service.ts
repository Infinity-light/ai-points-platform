import { Injectable } from '@nestjs/common';
import type {
  BitableFieldMapping,
  SyncDirection,
} from '../feishu/entities/feishu-bitable-binding.entity';

export interface FieldDefinition {
  feishuFieldName: string;
  feishuFieldType: number;
  platformField: string;
}

export interface BitableSyncAdapter {
  entityType: string;
  defaultSyncDirection: SyncDirection;
  getDefaultFieldMappings(): Record<string, FieldDefinition>;
  toFeishuRecord(entity: unknown, fieldMapping: BitableFieldMapping): Record<string, unknown>;
  fromFeishuRecord(
    fields: Record<string, unknown>,
    fieldMapping: BitableFieldMapping,
  ): Record<string, unknown>;
  findEntity(tenantId: string, id: string): Promise<unknown>;
  findAllEntities(tenantId: string, projectId: string): Promise<unknown[]>;
  upsertFromFeishu(
    tenantId: string,
    projectId: string,
    data: Record<string, unknown>,
  ): Promise<{ id: string; isNew: boolean }>;
}

@Injectable()
export class BitableSyncRegistryService {
  private readonly adapters = new Map<string, BitableSyncAdapter>();

  register(adapter: BitableSyncAdapter): void {
    this.adapters.set(adapter.entityType, adapter);
  }

  get(entityType: string): BitableSyncAdapter | undefined {
    return this.adapters.get(entityType);
  }

  list(): BitableSyncAdapter[] {
    return Array.from(this.adapters.values());
  }
}
