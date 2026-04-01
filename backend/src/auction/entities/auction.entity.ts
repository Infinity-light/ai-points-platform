import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { Bid } from './bid.entity';

export type AuctionType = 'task_claim' | 'reward' | 'custom';
export type AuctionStatus = 'open' | 'closed' | 'cancelled';

@Entity('auctions')
@Index(['tenantId'])
export class Auction {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  @Index()
  tenantId!: string;

  @Column({ type: 'varchar', length: 20 })
  type!: AuctionType;

  @Column({ type: 'varchar', length: 100, nullable: true })
  targetEntity!: string | null;

  @Column({ type: 'uuid', nullable: true })
  targetId!: string | null;

  @Column({ type: 'text' })
  description!: string;

  @Column({ type: 'varchar', length: 20, default: 'open' })
  status!: AuctionStatus;

  @Column({ type: 'int', default: 0 })
  minBid!: number;

  @Column({ type: 'timestamp' })
  endsAt!: Date;

  @Column({ type: 'uuid', nullable: true })
  winnerId!: string | null;

  @Column({ type: 'int', nullable: true })
  winningBid!: number | null;

  @Column('uuid')
  createdBy!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @OneToMany(() => Bid, (bid) => bid.auction)
  bids!: Bid[];
}
