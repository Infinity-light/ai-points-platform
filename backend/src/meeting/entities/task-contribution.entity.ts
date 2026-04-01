import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { ReviewMeeting } from './review-meeting.entity';

@Entity('task_contributions')
export class TaskContribution {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  @Index()
  taskId!: string;

  @Column('uuid')
  userId!: string;

  @Column('uuid')
  tenantId!: string;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  percentage!: number;

  @Column('uuid')
  setInMeetingId!: string;

  @ManyToOne(() => ReviewMeeting, (m) => m.contributions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'setInMeetingId' })
  meeting!: ReviewMeeting;

  @CreateDateColumn()
  createdAt!: Date;
}
