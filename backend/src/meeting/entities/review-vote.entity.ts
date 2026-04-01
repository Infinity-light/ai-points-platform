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

  /**
   * null 表示认可 AI 分（isApproval=true 时为 null）
   * 有值表示自定义覆盖分数
   */
  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
  score!: number | null;

  @Column({ type: 'boolean', default: false })
  isApproval!: boolean;

  @CreateDateColumn()
  createdAt!: Date;
}
