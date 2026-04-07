import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { ReimbursementItem } from './reimbursement-item.entity';

export type ReimbursementType =
  | 'asset_purchase'
  | 'travel'
  | 'office_supply'
  | 'training'
  | 'software_license'
  | 'cloud_service'
  | 'other';

export type ReimbursementStatus =
  | 'draft'
  | 'submitted'
  | 'dept_approved'
  | 'finance_approved'
  | 'leader_approved'
  | 'paid'
  | 'completed'
  | 'rejected';

@Entity('reimbursements')
export class Reimbursement {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  @Index()
  tenantId!: string;

  @Column('uuid')
  @Index()
  submitterId!: string;

  @Column({ length: 30 })
  reimbursementType!: ReimbursementType;

  @Column({ length: 30, default: 'draft' })
  @Index()
  status!: ReimbursementStatus;

  @Column({ length: 200 })
  title!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalAmount!: number;

  @Column({ type: 'uuid', nullable: true })
  linkedAssetId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  approvalInstanceId!: string | null;

  @Column({ type: 'timestamp', nullable: true })
  paidAt!: Date | null;

  @Column({ length: 200, nullable: true })
  paymentReference!: string | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @OneToMany(() => ReimbursementItem, (item) => item.reimbursement, { cascade: true })
  items!: ReimbursementItem[];
}
