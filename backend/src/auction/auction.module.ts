import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { Auction } from './entities/auction.entity';
import { Bid } from './entities/bid.entity';
import { Task } from '../task/entities/task.entity';
import { AuctionService } from './auction.service';
import { AuctionController } from './auction.controller';
import { AuctionCloseProcessor } from '../queue/processors/auction-close.processor';
import { TaskAuctionListener } from './listeners/task-auction.listener';
import { QUEUE_NAMES } from '../queue/queue.constants';
import { RbacModule } from '../rbac/rbac.module';
import { TaskModule } from '../task/task.module';
import { TaskService } from '../task/task.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Auction, Bid, Task]),
    BullModule.registerQueue({ name: QUEUE_NAMES.AUCTION_CLOSE }),
    RbacModule,
    TaskModule,
  ],
  controllers: [AuctionController],
  providers: [AuctionService, AuctionCloseProcessor, TaskAuctionListener],
  exports: [AuctionService],
})
export class AuctionModule implements OnModuleInit {
  constructor(
    private readonly auctionService: AuctionService,
    private readonly taskService: TaskService,
  ) {}

  onModuleInit(): void {
    // Wire AuctionService into TaskService to avoid circular module dependency
    this.taskService.auctionServiceRef = this.auctionService;
  }
}
