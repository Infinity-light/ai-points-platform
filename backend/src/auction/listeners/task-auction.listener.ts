import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task } from '../../task/entities/task.entity';
import { Auction } from '../entities/auction.entity';

@Injectable()
export class TaskAuctionListener {
  private readonly logger = new Logger(TaskAuctionListener.name);

  constructor(
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,
  ) {}

  @OnEvent('auction.closed')
  async handleAuctionClosed(auction: Auction): Promise<void> {
    if (
      auction.type !== 'task_claim' ||
      auction.targetEntity !== 'task' ||
      !auction.targetId ||
      !auction.winnerId
    ) {
      return;
    }

    try {
      const task = await this.taskRepo.findOne({
        where: { id: auction.targetId, tenantId: auction.tenantId },
      });

      if (!task) {
        this.logger.warn(`Task ${auction.targetId} not found for auction ${auction.id}`);
        return;
      }

      task.assigneeId = auction.winnerId;
      task.metadata = {
        ...task.metadata,
        auctionInfo: {
          auctionId: auction.id,
          bidAmount: auction.winningBid,
          closedAt: auction.updatedAt,
        },
      };

      await this.taskRepo.save(task);
      this.logger.log(
        `Task ${task.id} assigned to ${auction.winnerId} via auction ${auction.id}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to assign task ${auction.targetId} from auction ${auction.id}: ${String(error)}`,
      );
    }
  }
}
