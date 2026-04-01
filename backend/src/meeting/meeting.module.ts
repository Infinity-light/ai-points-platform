import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { MeetingService } from './meeting.service';
import { MeetingGateway } from './meeting.gateway';
import { MeetingController } from './meeting.controller';
import { ReviewMeeting } from './entities/review-meeting.entity';
import { ReviewVote } from './entities/review-vote.entity';
import { TaskContribution } from './entities/task-contribution.entity';
import { Task } from '../task/entities/task.entity';
import { RbacModule } from '../rbac/rbac.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ReviewMeeting, ReviewVote, TaskContribution, Task]),
    JwtModule.register({}),
    RbacModule,
  ],
  controllers: [MeetingController],
  providers: [MeetingService, MeetingGateway],
  exports: [MeetingService],
})
export class MeetingModule {}
