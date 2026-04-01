import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { ReviewVote } from './review-vote.entity';
import { TaskContribution } from './task-contribution.entity';

export type ReviewMeetingStatus = 'open' | 'closed' | 'cancelled';

export interface MeetingTaskResult {
  finalScore: number;
  voteCount: number;
  approvalCount: number;
  challengeCount: number;
  medianScore: number;
}

@Entity('review_meetings')
@Index(['tenantId'])
@Index(['projectId'])
export class ReviewMeeting {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  @Index()
  tenantId!: string;

  @Column('uuid')
  @Index()
  projectId!: string;

  @Column('uuid')
  createdBy!: string;

  @Column({ type: 'varchar', length: 20, default: 'open' })
  status!: ReviewMeetingStatus;

  @Column({ type: 'jsonb', default: [] })
  taskIds!: string[];

  @Column({ type: 'jsonb', nullable: true })
  results!: Record<string, MeetingTaskResult> | null;

  @Column({ type: 'int', default: 0 })
  participantCount!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @Column({ type: 'timestamp', nullable: true })
  closedAt!: Date | null;

  @OneToMany(() => ReviewVote, (v) => v.meeting)
  votes!: ReviewVote[];

  @OneToMany(() => TaskContribution, (c) => c.meeting)
  contributions!: TaskContribution[];
}
