import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum SubmissionType {
  EXPLORE = 'explore',     // Skill/文档，Git 仓库关联
  AI_EXEC = 'ai-exec',    // Commit，Git Webhook 自动关联
  MANUAL = 'manual',       // 人工附件
}

@Entity('submissions')
@Index(['tenantId', 'taskId'])
export class Submission {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  @Index()
  tenantId!: string;

  @Column('uuid')
  @Index()
  taskId!: string;

  @Column('uuid')
  submittedBy!: string; // userId

  @Column({ type: 'enum', enum: SubmissionType })
  type!: SubmissionType;

  @Column({ type: 'text' })
  content!: string; // 提交说明/描述

  @Column({ type: 'jsonb', default: {} })
  metadata!: {
    // For explore: { repoUrl?, commitHash?, filePaths? }
    // For ai-exec: { commitHash, repoUrl, commitMessage? }
    // For manual: { uploadIds: string[] }
    [key: string]: unknown;
  };

  @Column({ default: 'pending' })
  aiReviewStatus!: 'pending' | 'processing' | 'completed' | 'failed';

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
