import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { AiProvider } from './ai-provider.entity';

@Entity('ai_provider_keys')
@Index(['tenantId'])
export class AiProviderKey {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  @Index()
  tenantId!: string;

  @Column('uuid')
  providerId!: string;

  @ManyToOne(() => AiProvider, (p) => p.keys, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'providerId' })
  provider!: AiProvider;

  @Column({ length: 100 })
  label!: string;

  @Column({ type: 'text' })
  encryptedKey!: string;

  @Column({ length: 100, nullable: true })
  model!: string | null;

  @Column({ default: true })
  isActive!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  lastUsedAt!: Date | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
