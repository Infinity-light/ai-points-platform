import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BrainService } from './brain.service';
import { BrainController } from './brain.controller';
import { BrainConversation } from './entities/brain-conversation.entity';
import { TaskModule } from '../task/task.module';
import { ProjectModule } from '../project/project.module';
import { PointsModule } from '../points/points.module';
import { SkillModule } from '../skill/skill.module';
import { Submission } from '../submission/entities/submission.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([BrainConversation, Submission]),
    TaskModule,
    ProjectModule,
    PointsModule,
    SkillModule,
  ],
  controllers: [BrainController],
  providers: [BrainService],
  exports: [BrainService],
})
export class BrainModule {}
