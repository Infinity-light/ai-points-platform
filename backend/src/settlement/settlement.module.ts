import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SettlementService } from './settlement.service';
import { SettlementController } from './settlement.controller';
import { Settlement } from './entities/settlement.entity';
import { VoteModule } from '../vote/vote.module';
import { TaskModule } from '../task/task.module';
import { PointsModule } from '../points/points.module';
import { ProjectModule } from '../project/project.module';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Settlement]),
    VoteModule,
    TaskModule,
    PointsModule,
    ProjectModule,
    UserModule,
  ],
  controllers: [SettlementController],
  providers: [SettlementService],
  exports: [SettlementService],
})
export class SettlementModule {}
