import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { WebhookService } from './webhook.service';
import { WebhookController } from './webhook.controller';
import { WebhookLog } from './entities/webhook-log.entity';
import { TaskModule } from '../task/task.module';
import { SubmissionModule } from '../submission/submission.module';
import { QUEUE_NAMES } from '../queue/queue.constants';

@Module({
  imports: [
    TypeOrmModule.forFeature([WebhookLog]),
    BullModule.registerQueue({ name: QUEUE_NAMES.AI_REVIEW }),
    TaskModule,
    SubmissionModule,
  ],
  controllers: [WebhookController],
  providers: [WebhookService],
})
export class WebhookModule {}
