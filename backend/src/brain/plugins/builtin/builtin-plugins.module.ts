import { Module } from '@nestjs/common';
import { TaskModule } from '../../../task/task.module';
import { PointsModule } from '../../../points/points.module';
import { ProjectModule } from '../../../project/project.module';
import { SubmissionModule } from '../../../submission/submission.module';
import { SettlementModule } from '../../../settlement/settlement.module';
import { AuctionModule } from '../../../auction/auction.module';
import { TasksPlugin } from './tasks.plugin';
import { PointsPlugin } from './points.plugin';
import { MembersPlugin } from './members.plugin';
import { SubmissionsPlugin } from './submissions.plugin';
import { SettlementPlugin } from './settlement.plugin';
import { AuctionPlugin } from './auction.plugin';

export const BUILTIN_PLUGINS = [
  TasksPlugin,
  PointsPlugin,
  MembersPlugin,
  SubmissionsPlugin,
  SettlementPlugin,
  AuctionPlugin,
];

@Module({
  imports: [
    TaskModule,
    PointsModule,
    ProjectModule,
    SubmissionModule,
    SettlementModule,
    AuctionModule,
  ],
  providers: BUILTIN_PLUGINS,
  exports: BUILTIN_PLUGINS,
})
export class BuiltinPluginsModule {}
