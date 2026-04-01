import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Auction, AuctionType, AuctionStatus } from './entities/auction.entity';
import { Bid } from './entities/bid.entity';
import { QUEUE_NAMES } from '../queue/queue.constants';
import { AUCTION_CLOSE_JOB } from '../queue/processors/auction-close.processor';

export interface CreateAuctionDto {
  type: AuctionType;
  targetEntity?: string;
  targetId?: string;
  description: string;
  minBid?: number;
  endsAt: Date;
}

export interface AuctionFilters {
  status?: AuctionStatus;
  type?: AuctionType;
}

@Injectable()
export class AuctionService {
  private readonly logger = new Logger(AuctionService.name);

  constructor(
    @InjectRepository(Auction)
    private readonly auctionRepo: Repository<Auction>,
    @InjectRepository(Bid)
    private readonly bidRepo: Repository<Bid>,
    @InjectQueue(QUEUE_NAMES.AUCTION_CLOSE)
    private readonly auctionCloseQueue: Queue,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(opts: {
    tenantId: string;
    createdBy: string;
    dto: CreateAuctionDto;
  }): Promise<Auction> {
    const { tenantId, createdBy, dto } = opts;

    const now = new Date();
    const endsAt = dto.endsAt instanceof Date ? dto.endsAt : new Date(dto.endsAt);
    if (endsAt <= now) {
      throw new BadRequestException('竞拍截止时间必须在当前时间之后');
    }

    const auction = this.auctionRepo.create({
      tenantId,
      createdBy,
      type: dto.type,
      targetEntity: dto.targetEntity ?? null,
      targetId: dto.targetId ?? null,
      description: dto.description,
      minBid: dto.minBid ?? 0,
      endsAt,
      status: 'open',
      winnerId: null,
      winningBid: null,
    });

    const saved = await this.auctionRepo.save(auction);

    // 添加延迟任务，到期自动关闭
    const delay = endsAt.getTime() - now.getTime();
    await this.auctionCloseQueue.add(
      AUCTION_CLOSE_JOB,
      { auctionId: saved.id },
      { delay, jobId: `auction-close-${saved.id}` },
    );

    this.logger.log(`Auction ${saved.id} created, auto-close in ${delay}ms`);
    return saved;
  }

  async placeBid(opts: {
    auctionId: string;
    userId: string;
    tenantId: string;
    amount: number;
  }): Promise<Bid> {
    const { auctionId, userId, tenantId, amount } = opts;

    const auction = await this.getOrFail(auctionId, tenantId);
    if (auction.status !== 'open') {
      throw new BadRequestException('竞拍已结束，无法出价');
    }
    if (new Date() > auction.endsAt) {
      throw new BadRequestException('竞拍已过截止时间');
    }

    const highest = await this.getHighestBid(auctionId);
    const minRequired = highest ? highest.amount + 1 : auction.minBid;

    if (amount < minRequired) {
      throw new BadRequestException(
        `出价必须不低于 ${minRequired}（当前最高：${highest?.amount ?? auction.minBid - 1}）`,
      );
    }

    const bid = this.bidRepo.create({ auctionId, userId, tenantId, amount });
    return this.bidRepo.save(bid);
  }

  async close(auctionId: string): Promise<Auction> {
    const auction = await this.auctionRepo.findOne({ where: { id: auctionId } });
    if (!auction) {
      throw new NotFoundException(`竞拍 ${auctionId} 不存在`);
    }
    if (auction.status !== 'open') {
      this.logger.warn(`Auction ${auctionId} already ${auction.status}, skip close`);
      return auction;
    }

    const highest = await this.getHighestBid(auctionId);
    auction.status = 'closed';
    if (highest) {
      auction.winnerId = highest.userId;
      auction.winningBid = highest.amount;
    }

    const saved = await this.auctionRepo.save(auction);
    this.eventEmitter.emit('auction.closed', saved);
    this.logger.log(`Auction ${auctionId} closed. Winner: ${saved.winnerId ?? 'none'}`);
    return saved;
  }

  async cancel(opts: { auctionId: string; tenantId: string }): Promise<Auction> {
    const { auctionId, tenantId } = opts;
    const auction = await this.getOrFail(auctionId, tenantId);

    if (auction.status !== 'open') {
      throw new BadRequestException('只能取消进行中的竞拍');
    }

    auction.status = 'cancelled';
    return this.auctionRepo.save(auction);
  }

  async list(opts: {
    tenantId: string;
    filters?: AuctionFilters;
  }): Promise<Auction[]> {
    const { tenantId, filters } = opts;
    const where: Record<string, unknown> = { tenantId };
    if (filters?.status) where['status'] = filters.status;
    if (filters?.type) where['type'] = filters.type;

    return this.auctionRepo.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  async get(opts: { auctionId: string; tenantId: string }): Promise<Auction & { bids: Bid[] }> {
    const { auctionId, tenantId } = opts;
    const auction = await this.auctionRepo.findOne({
      where: { id: auctionId, tenantId },
      relations: ['bids'],
    });
    if (!auction) {
      throw new NotFoundException(`竞拍 ${auctionId} 不存在`);
    }
    // Sort bids descending by amount
    auction.bids.sort((a, b) => b.amount - a.amount);
    return auction as Auction & { bids: Bid[] };
  }

  async getHighestBid(auctionId: string): Promise<Bid | null> {
    const bid = await this.bidRepo.findOne({
      where: { auctionId },
      order: { amount: 'DESC' },
    });
    return bid ?? null;
  }

  private async getOrFail(auctionId: string, tenantId: string): Promise<Auction> {
    const auction = await this.auctionRepo.findOne({ where: { id: auctionId, tenantId } });
    if (!auction) {
      throw new NotFoundException(`竞拍 ${auctionId} 不存在`);
    }
    return auction;
  }
}
