import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { ReviewMeeting } from './review-meeting.entity';

@Entity('review_votes')
@Unique(['meetingId', 'taskId', 'userId'])
export class ReviewVote {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  @Index()
  meetingId!: string;

  @ManyToOne(() => ReviewMeeting, (m) => m.votes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'meetingId' })
  meeting!: ReviewMeeting;

  @Column('uuid')
  taskId!: string;

  @Column('uuid')
  userId!: string;

  @Column('uuid')
  tenantId!: string;

  /** 投出的工分数（正整数，无上限） */
  @Column({ type: 'integer', nullable: false, default: 0 })
  score!: number;

  @Column({ type: 'boolean', default: false })
  isApproval!: boolean;

  @CreateDateColumn()
  createdAt!: Date;
}
