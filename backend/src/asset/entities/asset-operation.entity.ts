import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Asset } from './asset.entity';

export type AssetOperationType =
  | 'accept'
  | 'assign'
  | 'return'
  | 'transfer'
  | 'repair_start'
  | 'repair_end'
  | 'loan'
  | 'loan_return'
  | 'dispose'
  | 'renew';

@Entity('asset_operations')
export class AssetOperation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  @Index()
  tenantId!: string;

  @Column('uuid')
  @Index()
  assetId!: string;

  @Column({ length: 30 })
  operationType!: AssetOperationType;

  @Column({ type: 'uuid', nullable: true })
  fromUserId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  toUserId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  approvalInstanceId!: string | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column('uuid')
  operatedBy!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @ManyToOne(() => Asset, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'assetId' })
  asset!: Asset;
}
