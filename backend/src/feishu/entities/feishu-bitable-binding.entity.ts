import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export interface BitableFieldMapping {
  title?: string;       // 飞书字段 ID for 任务标题
  assignees?: string;   // 飞书字段 ID for 负责人（人员类型）
  status?: string;      // 飞书字段 ID for 状态
  description?: string; // 飞书字段 ID for 工作成果说明
  attachments?: string; // 飞书字段 ID for 附件
  [key: string]: string | undefined; // 扩展字段映射
}

export type BitableSyncStatus = 'idle' | 'syncing' | 'error';
export type SyncDirection = 'push_only' | 'pull_only' | 'bidirectional';
export type ConflictStrategy = 'last_write_wins' | 'platform_wins' | 'feishu_wins';

@Entity('feishu_bitable_bindings')
@Index(['tenantId', 'projectId', 'entityType'], { unique: true })
export class FeishuBitableBinding {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  @Index()
  tenantId!: string;

  @Column('uuid')
  projectId!: string;

  @Column({ type: 'varchar', length: 200 })
  appToken!: string;

  @Column({ type: 'varchar', length: 200 })
  tableId!: string;

  @Column({ type: 'jsonb', default: {} })
  fieldMapping!: BitableFieldMapping;

  @Column({ type: 'varchar', length: 200, nullable: true })
  writebackFieldId!: string | null;

  @Column({ type: 'varchar', length: 20, default: 'idle' })
  syncStatus!: BitableSyncStatus;

  @Column({ type: 'timestamp', nullable: true })
  lastSyncAt!: Date | null;

  @Column({ type: 'text', nullable: true })
  lastSyncError!: string | null;

  // ─── New columns (migration 037) ─────────────────────────────────────────────

  @Column({ type: 'varchar', length: 50, default: 'task' })
  entityType!: string;

  @Column({ type: 'varchar', length: 20, default: 'bidirectional' })
  syncDirection!: SyncDirection;

  @Column({ type: 'varchar', length: 20, default: 'last_write_wins' })
  conflictStrategy!: ConflictStrategy;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
