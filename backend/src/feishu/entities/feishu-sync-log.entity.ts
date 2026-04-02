import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
} from 'typeorm';

export enum SyncType {
  FULL = 'full',
  INCREMENTAL = 'incremental',
}

export enum SyncStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  SUCCESS = 'success',
  FAILED = 'failed',
}

export interface SyncStats {
  newUsers?: number;
  updatedUsers?: number;
  resignedUsers?: number;
  newDepts?: number;
  updatedDepts?: number;
}

@Entity('feishu_sync_logs')
@Index(['tenantId', 'startedAt'])
export class FeishuSyncLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  tenantId!: string;

  @Column({ type: 'varchar', length: 20 })
  type!: SyncType;

  @Column({ type: 'varchar', length: 20, default: SyncStatus.PENDING })
  status!: SyncStatus;

  @Column({ type: 'jsonb', default: {} })
  stats!: SyncStats;

  @Column({ type: 'text', nullable: true })
  error!: string | null;

  @Column({ type: 'timestamp', default: () => 'now()' })
  startedAt!: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt!: Date | null;
}
