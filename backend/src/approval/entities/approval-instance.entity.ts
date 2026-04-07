import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { ApprovalRecord } from './approval-record.entity';

export type ApprovalStatus =
  | 'pending'
  | 'step1_approved'
  | 'step2_approved'
  | 'approved'
  | 'rejected'
  | 'returned';

export type ApprovalBusinessType = 'reimbursement' | 'asset_operation';

@Entity('approval_instances')
export class ApprovalInstance {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  @Index()
  tenantId!: string;

  @Column({ length: 50 })
  businessType!: ApprovalBusinessType;

  @Column('uuid')
  businessId!: string;

  @Column('uuid')
  @Index()
  submitterId!: string;

  @Column({ length: 20, default: 'pending' })
  status!: ApprovalStatus;

  @Column({ type: 'int', default: 1 })
  currentStep!: number;

  @Column({ type: 'uuid', nullable: true })
  step1ApproverId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  step2ApproverId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  step3ApproverId!: string | null;

  @Column({ type: 'timestamp', nullable: true })
  completedAt!: Date | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @OneToMany(() => ApprovalRecord, (record) => record.instance)
  records!: ApprovalRecord[];
}
