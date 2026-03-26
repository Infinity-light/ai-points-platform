import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VoteService } from './vote.service';
import { VoteController } from './vote.controller';
import { VoteSession } from './entities/vote-session.entity';
import { VoteRecord } from './entities/vote-record.entity';
import { PointsModule } from '../points/points.module';
import { ProjectModule } from '../project/project.module';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([VoteSession, VoteRecord]),
    PointsModule,
    ProjectModule,
    UserModule,
  ],
  controllers: [VoteController],
  providers: [VoteService],
  exports: [VoteService],
})
export class VoteModule {}
