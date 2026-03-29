import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { SubmissionService } from './submission.service';
import { SubmissionController } from './submission.controller';
import { Submission } from './entities/submission.entity';
import { TaskModule } from '../task/task.module';
import { QUEUE_NAMES } from '../queue/queue.constants';
import { SkillModule } from '../skill/skill.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Submission]),
    BullModule.registerQueue({ name: QUEUE_NAMES.AI_REVIEW }),
    TaskModule,
    forwardRef(() => SkillModule),
  ],
  controllers: [SubmissionController],
  providers: [SubmissionService],
  exports: [SubmissionService],
})
export class SubmissionModule {}
