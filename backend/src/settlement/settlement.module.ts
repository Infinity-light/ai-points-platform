import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SettlementService } from './settlement.service';
import { SettlementController } from './settlement.controller';
import { MeetingSettlementListener } from './meeting-settlement.listener';
import { Settlement } from './entities/settlement.entity';
import { VoteModule } from '../vote/vote.module';
import { TaskModule } from '../task/task.module';
import { PointsModule } from '../points/points.module';
import { ProjectModule } from '../project/project.module';
import { UserModule } from '../user/user.module';
import { User } from '../user/entities/user.entity';
import { DividendModule } from '../dividend/dividend.module';
import { RbacModule } from '../rbac/rbac.module';
import { ReviewMeeting } from '../meeting/entities/review-meeting.entity';
import { TaskContribution } from '../meeting/entities/task-contribution.entity';
import { PointsSnapshot } from '../points/entities/points-snapshot.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Settlement, User, ReviewMeeting, TaskContribution, PointsSnapshot]),
    VoteModule,
    TaskModule,
    PointsModule,
    ProjectModule,
    UserModule,
    forwardRef(() => DividendModule),
    RbacModule,
  ],
  controllers: [SettlementController],
  providers: [SettlementService, MeetingSettlementListener],
  exports: [SettlementService],
})
export class SettlementModule {}
