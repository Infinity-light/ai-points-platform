import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type AssetType = 'physical' | 'virtual';

export type AssetCategory =
  | 'laptop'
  | 'desktop'
  | 'monitor'
  | 'phone'
  | 'tablet'
  | 'server'
  | 'network'
  | 'peripheral'
  | 'cloud_vm'
  | 'cloud_storage'
  | 'saas_license'
  | 'domain'
  | 'other';

export type AssetStatus =
  | 'pending_acceptance'
  | 'in_use'
  | 'idle'
  | 'on_loan'
  | 'under_repair'
  | 'transferred'
  | 'pending_disposal'
  | 'disposed'
  | 'active'
  | 'expiring_soon'
  | 'expired'
  | 'renewed'
  | 'decommissioned';

@Entity('assets')
@Index(['tenantId', 'assetCode'], { unique: true })
export class Asset {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  @Index()
  tenantId!: string;

  @Column({ length: 50 })
  assetCode!: string;

  @Column({ length: 200 })
  name!: string;

  @Column({ length: 20 })
  assetType!: AssetType;

  @Column({ length: 50 })
  category!: string;

  @Column({ length: 30, default: 'pending_acceptance' })
  @Index()
  status!: AssetStatus;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  purchasePrice!: number | null;

  @Column({ type: 'int', nullable: true })
  usefulLifeMonths!: number | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  residualValue!: number | null;

  @Column({ type: 'date', nullable: true })
  purchaseDate!: string | null;

  @Column({ length: 200, nullable: true })
  vendor!: string | null;

  @Column({ length: 200, nullable: true })
  serialNumber!: string | null;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt!: Date | null;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  assignedUserId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  departmentId!: string | null;

  @Column({ type: 'jsonb', default: {} })
  metadata!: Record<string, unknown>;

  @Column({ length: 200, nullable: true })
  feishuRecordId!: string | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column('uuid')
  createdBy!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
