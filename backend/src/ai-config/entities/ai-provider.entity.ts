import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { AiProviderKey } from './ai-provider-key.entity';

@Entity('ai_providers')
@Index(['tenantId'])
export class AiProvider {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  @Index()
  tenantId!: string;

  @Column({ length: 100 })
  name!: string;

  @Column({ length: 50 })
  type!: 'anthropic' | 'openai' | 'azure_openai' | 'custom';

  @Column({ length: 500, nullable: true })
  baseUrl!: string | null;

  @Column({ default: true })
  isActive!: boolean;

  @Column({ type: 'jsonb', default: {} })
  config!: Record<string, unknown>;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @OneToMany(() => AiProviderKey, (k) => k.provider)
  keys!: AiProviderKey[];
}
