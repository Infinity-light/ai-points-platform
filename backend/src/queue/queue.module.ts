import { Module, Global } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';
import redisConfig from '../config/redis.config';
import { AiReviewProcessor } from './processors/ai-review.processor';
import { NotificationProcessor } from './processors/notification.processor';
import { SettlementProcessor } from './processors/settlement.processor';
import { AiModule } from '../ai/ai.module';
import { TaskModule } from '../task/task.module';

export { QUEUE_NAMES } from './queue.constants';

import { QUEUE_NAMES } from './queue.constants';

@Global()
@Module({
  imports: [
    ConfigModule.forFeature(redisConfig),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        redis: {
          host: configService.get<string>('redis.host'),
          port: configService.get<number>('redis.port'),
          password: configService.get<string | undefined>('redis.password'),
          db: configService.get<number>('redis.db'),
        },
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: 100,
          removeOnFail: 50,
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue(
      { name: QUEUE_NAMES.AI_REVIEW },
      { name: QUEUE_NAMES.NOTIFICATION },
      { name: QUEUE_NAMES.SETTLEMENT },
      { name: QUEUE_NAMES.AUCTION_CLOSE },
    ),
    AiModule,
    TaskModule,
  ],
  providers: [AiReviewProcessor, NotificationProcessor, SettlementProcessor],
  exports: [BullModule],
})
export class QueueModule {}
