import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum ProjectStatus {
  ACTIVE = 'active',
  ARCHIVED = 'archived',
}

export interface AnnealingConfig {
  cyclesPerStep: number; // 每档需要经历的结算次数，默认3
  maxSteps: number;      // 最大档数（超过后清零），默认9 → 约27次结算后清零
}

export interface SettlementConfig {
  periodType: 'weekly' | 'monthly';
  dayOfWeek?: number;   // 0-6, 仅 weekly
  dayOfMonth?: number;  // 1-28, 仅 monthly
}

@Entity('projects')
@Index(['tenantId'])
export class Project {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  @Index()
  tenantId!: string;

  @Column({ length: 200 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'enum', enum: ProjectStatus, default: ProjectStatus.ACTIVE })
  status!: ProjectStatus;

  @Column({ type: 'jsonb', default: { cyclesPerStep: 3, maxSteps: 9 } })
  annealingConfig!: AnnealingConfig;

  @Column({ type: 'jsonb', default: { periodType: 'weekly', dayOfWeek: 1 } })
  settlementConfig!: SettlementConfig;

  @Column('uuid')
  createdBy!: string; // userId

  @Column({ default: 0 })
  settlementRound!: number; // 当前结算轮次计数

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
