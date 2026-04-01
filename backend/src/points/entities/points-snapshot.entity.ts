import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('points_snapshots')
@Index(['tenantId', 'projectId'])
@Index(['settlementId'])
export class PointsSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  @Index()
  tenantId!: string;

  @Column('uuid')
  projectId!: string;

  @Column('uuid')
  settlementId!: string;

  @Column('uuid')
  userId!: string;

  @Column({ type: 'varchar', length: 100 })
  userName!: string;

  @Column({ type: 'int', default: 0 })
  rawPoints!: number;

  @Column({ type: 'int', default: 0 })
  activePoints!: number;

  @Column({ type: 'int', nullable: true })
  rank!: number | null;

  @CreateDateColumn()
  createdAt!: Date;
}
