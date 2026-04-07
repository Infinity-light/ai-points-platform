import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

export type SyncLogStatus = 'running' | 'completed' | 'failed';
export type SyncLogType = 'full' | 'incremental' | 'push' | 'webhook';
export type SyncLogDirection = 'platform_to_feishu' | 'feishu_to_platform';

@Entity('bitable_sync_logs')
export class BitableSyncLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  @Index()
  tenantId!: string;

  @Column('uuid')
  @Index()
  bindingId!: string;

  @Column({ type: 'varchar', length: 20 })
  syncType!: SyncLogType;

  @Column({ type: 'varchar', length: 20 })
  direction!: SyncLogDirection;

  @Column({ type: 'varchar', length: 20, default: 'running' })
  status!: SyncLogStatus;

  @Column({ type: 'int', default: 0 })
  recordsProcessed!: number;

  @Column({ type: 'int', default: 0 })
  recordsCreated!: number;

  @Column({ type: 'int', default: 0 })
  recordsUpdated!: number;

  @Column({ type: 'int', default: 0 })
  recordsFailed!: number;

  @Column({ type: 'text', nullable: true })
  errorMessage!: string | null;

  @Column({ type: 'timestamp', default: () => 'now()' })
  startedAt!: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt!: Date | null;
}
