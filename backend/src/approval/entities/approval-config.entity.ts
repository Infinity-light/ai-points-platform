import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type ApprovalConfigType = 'reimbursement' | 'asset_operation';
export type DeptApproverMode = 'department_head' | 'manual';

@Entity('approval_configs')
@Index(['tenantId', 'configType'], { unique: true })
export class ApprovalConfig {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  @Index()
  tenantId!: string;

  @Column({ length: 50 })
  configType!: ApprovalConfigType;

  @Column({ length: 20, default: 'department_head' })
  deptApproverMode!: DeptApproverMode;

  @Column({ type: 'uuid', nullable: true })
  financePersonId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  finalApproverId!: string | null;

  @Column({ default: true })
  isActive!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
