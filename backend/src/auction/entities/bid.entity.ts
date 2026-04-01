import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Auction } from './auction.entity';

@Entity('bids')
export class Bid {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  @Index()
  auctionId!: string;

  @ManyToOne(() => Auction, (auction) => auction.bids, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'auctionId' })
  auction!: Auction;

  @Column('uuid')
  userId!: string;

  @Column('uuid')
  tenantId!: string;

  @Column({ type: 'int' })
  amount!: number;

  @CreateDateColumn()
  createdAt!: Date;
}
