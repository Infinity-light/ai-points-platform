import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { TaskStatus } from '../enums/task-status.enum';

export interface TaskMetadata {
  // 标准字段模板（飞书表格风格）
  expectedOutput?: string;     // 预期产出
  estimatedPoints?: number;    // 预估工分
  tags?: string[];             // 标签
  priority?: 'low' | 'medium' | 'high';
  deadline?: string;           // ISO date string
  // AI评审结果
  aiScores?: {
    research: number;    // 调查 0-5
    planning: number;    // 规划 0-5
    execution: number;   // 执行 0-5
    average: number;     // 三次调用均值
    rawScores: Array<{ research: number; planning: number; execution: number }>;
  };
  // 工分记录
  finalPoints?: number;        // 投票后固化的工分
  // 附加自定义字段（由项目负责人定义）
  [key: string]: unknown;
}

@Entity('tasks')
@Index(['tenantId', 'projectId'])
@Index(['assigneeId'])
export class Task {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  @Index()
  tenantId!: string;

  @Column('uuid')
  @Index()
  projectId!: string;

  @Column({ length: 500 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'enum', enum: TaskStatus, default: TaskStatus.OPEN })
  status!: TaskStatus;

  @Column({ type: 'uuid', nullable: true })
  assigneeId!: string | null; // 认领者 userId

  @Column({ type: 'uuid' })
  createdBy!: string; // 创建者 userId

  @Column({ type: 'jsonb', default: {} })
  metadata!: TaskMetadata;

  @Column({ type: 'integer', nullable: true })
  estimatedPoints!: number | null; // 快捷字段（也存在 metadata 中）

  @Column({ type: 'varchar', length: 20, default: 'single' })
  claimMode!: 'single' | 'multi';

  @Column({ type: 'varchar', length: 200, nullable: true })
  @Index()
  feishuRecordId!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
