import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
  Index,
} from 'typeorm';
@Entity('brain_plugin_configs')
@Unique(['tenantId', 'pluginId'])
export class BrainPluginConfig {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column('uuid')
  tenantId!: string;

  @Column({ length: 128 })
  pluginId!: string;

  @Column({ length: 32 })
  type!: string;

  @Column({ default: true })
  enabled!: boolean;

  @Column({ type: 'jsonb', default: {} })
  config!: Record<string, unknown>;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
