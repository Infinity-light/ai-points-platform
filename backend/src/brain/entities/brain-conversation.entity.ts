import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { ToolCallRecord } from '../interfaces/brain-plugin.interface';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  /** Tool calls made during this assistant turn (backward-compatible, optional) */
  toolCalls?: ToolCallRecord[];
}

@Entity('brain_conversations')
@Index(['tenantId', 'projectId', 'userId'])
export class BrainConversation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  tenantId!: string;

  @Column('uuid')
  projectId!: string;

  @Column('uuid')
  userId!: string;

  @Column({ type: 'jsonb', default: [] })
  messages!: ChatMessage[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
