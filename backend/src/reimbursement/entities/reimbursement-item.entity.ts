import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Reimbursement } from './reimbursement.entity';

@Entity('reimbursement_items')
export class ReimbursementItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  @Index()
  reimbursementId!: string;

  @Column({ length: 500 })
  description!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount!: number;

  @Column({ type: 'date' })
  expenseDate!: string;

  @Column({ type: 'jsonb', default: [] })
  receiptUploadIds!: string[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @ManyToOne(() => Reimbursement, (r) => r.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reimbursementId' })
  reimbursement!: Reimbursement;
}
