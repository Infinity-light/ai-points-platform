import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BrainService } from './brain.service';
import { BrainController } from './brain.controller';
import { BrainConversation } from './entities/brain-conversation.entity';
import { TaskModule } from '../task/task.module';
import { ProjectModule } from '../project/project.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([BrainConversation]),
    TaskModule,
    ProjectModule,
  ],
  controllers: [BrainController],
  providers: [BrainService],
  exports: [BrainService],
})
export class BrainModule {}
