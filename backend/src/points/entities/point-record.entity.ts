import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum PointSource {
  TASK_SETTLEMENT = 'task_settlement', // 任务工分固化
  ADJUSTMENT = 'adjustment',           // 管理员手动调整
}

@Entity('point_records')
@Index(['tenantId', 'userId', 'projectId'])
export class PointRecord {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  @Index()
  tenantId!: string;

  @Column('uuid')
  @Index()
  userId!: string;

  @Column('uuid')
  @Index()
  projectId!: string;

  @Column()
  originalPoints!: number; // 原始工分（不变）

  @Column()
  acquiredRound!: number; // 获得时的结算轮次

  @Column({ type: 'enum', enum: PointSource, default: PointSource.TASK_SETTLEMENT })
  source!: PointSource;

  @Column('uuid', { nullable: true })
  taskId!: string | null; // 来源任务ID

  @Column('uuid', { nullable: true })
  voteSessionId!: string | null; // 关联的投票会话

  @CreateDateColumn()
  createdAt!: Date;
}
