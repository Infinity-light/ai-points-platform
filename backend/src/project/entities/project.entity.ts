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

export interface FieldDef {
  key: string;
  name: string;
  type: 'text' | 'number' | 'date' | 'single_select' | 'multi_select';
  options?: string[];
  order: number;
}

export interface ProjectMetadata {
  customFields?: FieldDef[];
}

export interface AnnealingConfig {
  cyclesPerStep: number; // 每档需要经历的结算次数，默认3
  maxSteps: number;      // 最大档数（tier >= maxSteps 时清零），默认4 → 12次结算后清零
}

export interface SettlementConfig {
  mode: 'manual' | 'reminder' | 'auto';
  schedule?: {
    periodType: 'weekly' | 'monthly';
    dayOfWeek?: number;   // 0-6, 仅 weekly
    dayOfMonth?: number;  // 1-31, 仅 monthly（若当月不足则取最后一天）
  };
  // Legacy fields — kept for backward compatibility during migration
  periodType?: 'weekly' | 'monthly';
  dayOfWeek?: number;
  dayOfMonth?: number;
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

  @Column({ type: 'jsonb', default: { cyclesPerStep: 3, maxSteps: 4 } })
  annealingConfig!: AnnealingConfig;

  @Column({ type: 'jsonb', default: { mode: 'manual' } })
  settlementConfig!: SettlementConfig;

  @Column('uuid')
  createdBy!: string; // userId

  @Column({ default: 0 })
  settlementRound!: number; // 当前结算轮次计数

  @Column({ type: 'jsonb', default: {} })
  metadata!: ProjectMetadata;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
