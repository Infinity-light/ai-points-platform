import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('settlements')
@Index(['tenantId', 'projectId'])
export class Settlement {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  @Index()
  tenantId!: string;

  @Column('uuid')
  @Index()
  projectId!: string;

  @Column()
  roundNumber!: number; // 本次结算是第几轮

  @Column('uuid')
  triggeredBy!: string; // userId

  @Column('uuid')
  voteSessionId!: string; // 关联的投票会话

  @Column({ type: 'jsonb', default: [] })
  settledTaskIds!: string[]; // 本次固化的任务ID列表

  @Column({ type: 'jsonb', default: {} })
  summary!: {
    totalPointsAwarded: number;
    usersAffected: number;
  };

  @CreateDateColumn()
  createdAt!: Date;
}
