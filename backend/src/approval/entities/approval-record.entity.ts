import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { ApprovalInstance } from './approval-instance.entity';

export type ApprovalAction = 'approved' | 'rejected' | 'returned';

@Entity('approval_records')
export class ApprovalRecord {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  @Index()
  instanceId!: string;

  @Column('uuid')
  approverId!: string;

  @Column('int')
  step!: number;

  @Column({ length: 20 })
  action!: ApprovalAction;

  @Column({ type: 'text', nullable: true })
  comment!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @ManyToOne(() => ApprovalInstance, (instance) => instance.records, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'instanceId' })
  instance!: ApprovalInstance;
}
