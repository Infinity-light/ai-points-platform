import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('audit_logs')
@Index(['tenantId', 'createdAt'])
@Index(['tenantId', 'resource', 'resourceId'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index()
  tenantId!: string;

  @Column({ type: 'uuid' })
  actorId!: string;

  @Column({ type: 'varchar', length: 200 })
  actorName!: string;

  @Column({ type: 'varchar', length: 100 })
  action!: string;

  @Column({ type: 'varchar', length: 100 })
  resource!: string;

  @Column({ type: 'uuid', nullable: true })
  resourceId!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  previousData!: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  newData!: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  ipAddress!: string | null;

  @CreateDateColumn()
  createdAt!: Date;
}
