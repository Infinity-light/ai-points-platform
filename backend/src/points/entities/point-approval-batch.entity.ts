import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum PointApprovalBatchStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Entity('point_approval_batches')
@Index(['tenantId', 'projectId'])
export class PointApprovalBatch {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  @Index()
  tenantId!: string;

  @Column('uuid')
  @Index()
  projectId!: string;

  @Column('uuid')
  submittedBy!: string;

  @Column({ type: 'jsonb', default: [] })
  pointRecordIds!: string[];

  @Column()
  totalPoints!: number;

  @Column({
    type: 'enum',
    enum: PointApprovalBatchStatus,
    default: PointApprovalBatchStatus.PENDING,
  })
  status!: PointApprovalBatchStatus;

  @Column('uuid', { nullable: true })
  reviewedBy!: string | null;

  @Column({ type: 'text', nullable: true })
  reviewNote!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
