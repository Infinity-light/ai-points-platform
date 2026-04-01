import { Processor, Process, OnQueueFailed, OnQueueCompleted } from '@nestjs/bull';
import { Inject, Logger, forwardRef } from '@nestjs/common';
import type { Job } from 'bull';
import { QUEUE_NAMES } from '../queue.constants';
import { AuctionService } from '../../auction/auction.service';

export const AUCTION_CLOSE_JOB = 'auto-close';

export interface AuctionCloseJobData {
  auctionId: string;
}

@Processor(QUEUE_NAMES.AUCTION_CLOSE)
export class AuctionCloseProcessor {
  private readonly logger = new Logger(AuctionCloseProcessor.name);

  constructor(
    @Inject(forwardRef(() => AuctionService))
    private readonly auctionService: AuctionService,
  ) {}

  @Process(AUCTION_CLOSE_JOB)
  async handleAutoClose(job: Job<AuctionCloseJobData>): Promise<void> {
    const { auctionId } = job.data;
    this.logger.log(`Auto-closing auction: ${auctionId}`);

    try {
      await this.auctionService.close(auctionId);
      this.logger.log(`Auction ${auctionId} auto-closed successfully`);
    } catch (error) {
      this.logger.error(`Failed to auto-close auction ${auctionId}: ${String(error)}`);
      throw error;
    }
  }

  @OnQueueCompleted()
  onCompleted(job: Job): void {
    this.logger.log(`Auction close job ${job.id} completed`);
  }

  @OnQueueFailed()
  onFailed(job: Job, error: Error): void {
    this.logger.error(`Auction close job ${job.id} failed: ${error.message}`, error.stack);
  }
}
