import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum DividendStatus {
  DRAFT = 'draft',
  PENDING_APPROVAL = 'pending_approval',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export interface DividendDetailEntry {
  userName: string;
  activePoints: number;
  ratio: number;
  amount: number | null;
}

export interface DividendDetails {
  [userId: string]: DividendDetailEntry;
}

@Entity('dividends')
@Index(['tenantId', 'projectId'])
export class Dividend {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  @Index()
  tenantId!: string;

  @Column('uuid')
  @Index()
  projectId!: string;

  @Column('uuid')
  settlementId!: string;

  @Column()
  roundNumber!: number;

  @Column({ nullable: true })
  totalAmount!: number | null;

  @Column()
  totalActivePoints!: number;

  @Column({ type: 'jsonb', default: {} })
  details!: DividendDetails;

  @Column({
    type: 'enum',
    enum: DividendStatus,
    default: DividendStatus.DRAFT,
  })
  status!: DividendStatus;

  @Column('uuid', { nullable: true })
  approvedBy!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
