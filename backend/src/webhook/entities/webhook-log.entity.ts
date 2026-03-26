import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('webhook_logs')
export class WebhookLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  @Index()
  tenantId!: string;

  @Column('uuid', { nullable: true })
  @Index()
  taskId!: string | null;

  @Column({ length: 100 })
  commitHash!: string;

  @Column({ type: 'text' })
  commitMessage!: string;

  @Column({ length: 500 })
  repoUrl!: string;

  @Column({ length: 500 })
  commitUrl!: string;

  @Column({ default: 'processing' })
  status!: 'processing' | 'completed' | 'failed' | 'skipped';

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  @CreateDateColumn()
  createdAt!: Date;
}
