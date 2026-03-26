import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  Unique,
} from 'typeorm';

@Entity('vote_records')
@Unique(['voteSessionId', 'userId'])
export class VoteRecord {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  @Index()
  voteSessionId!: string;

  @Column('uuid')
  @Index()
  userId!: string;

  @Column('uuid')
  tenantId!: string;

  @Column()
  vote!: boolean; // true = 赞成, false = 反对

  @Column({ type: 'decimal', precision: 10, scale: 4 })
  weight!: number; // 投票权重（基于活跃工分）

  @CreateDateColumn()
  createdAt!: Date;
}
