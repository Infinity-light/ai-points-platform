import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum VoteSessionStatus {
  OPEN = 'open',
  CLOSED = 'closed',
  PASSED = 'passed',
  FAILED = 'failed',
}

@Entity('vote_sessions')
@Index(['tenantId', 'projectId'])
export class VoteSession {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  @Index()
  tenantId!: string;

  @Column('uuid')
  @Index()
  projectId!: string;

  @Column({ type: 'enum', enum: VoteSessionStatus, default: VoteSessionStatus.OPEN })
  status!: VoteSessionStatus;

  @Column('uuid')
  createdBy!: string; // 发起人 userId

  @Column({ type: 'jsonb', default: [] })
  taskIds!: string[]; // 本次投票的任务列表

  @Column({ type: 'jsonb', default: {} })
  result!: {
    totalWeight?: number;
    yesWeight?: number;
    noWeight?: number;
    participantCount?: number;
    totalMemberCount?: number;
    weightedYesRatio?: number;
    participationRatio?: number;
  };

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
