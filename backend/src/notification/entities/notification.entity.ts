import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

export enum NotificationType {
  TASK_ASSIGNED = 'TASK_ASSIGNED',
  TASK_SCORE_READY = 'TASK_SCORE_READY',
  VOTE_STARTED = 'VOTE_STARTED',
  POINTS_AWARDED = 'POINTS_AWARDED',
  SETTLEMENT_COMPLETE = 'SETTLEMENT_COMPLETE',
}

@Entity('notifications')
@Index(['userId', 'isRead'])
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  @Index()
  userId!: string;

  @Column('uuid')
  tenantId!: string;

  @Column({ type: 'enum', enum: NotificationType })
  type!: NotificationType;

  @Column({ length: 200 })
  title!: string;

  @Column({ length: 500 })
  content!: string;

  @Column({ default: false })
  isRead!: boolean;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, any> | null;

  @CreateDateColumn()
  createdAt!: Date;
}
