import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('feishu_bitable_records')
@Index(['bindingId', 'feishuRecordId'], { unique: true })
export class FeishuBitableRecord {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  @Index()
  bindingId!: string;

  @Column({ type: 'varchar', length: 200 })
  feishuRecordId!: string;

  @Column({ type: 'uuid', nullable: true })
  taskId!: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  lastEventId!: string | null;

  @Column({ type: 'timestamp', nullable: true })
  lastSyncAt!: Date | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
