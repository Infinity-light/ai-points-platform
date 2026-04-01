import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BulletinService } from './bulletin.service';
import { BulletinController, PublicBulletinController } from './bulletin.controller';
import { RbacModule } from '../rbac/rbac.module';
import { PointsSnapshot } from '../points/entities/points-snapshot.entity';
import { Settlement } from '../settlement/entities/settlement.entity';
import { Dividend } from '../dividend/entities/dividend.entity';
import { ReviewMeeting } from '../meeting/entities/review-meeting.entity';
import { ReviewVote } from '../meeting/entities/review-vote.entity';
import { AuditLog } from '../audit/entities/audit-log.entity';
import { Tenant } from '../tenant/entities/tenant.entity';

@Module({
  imports: [
    RbacModule,
    TypeOrmModule.forFeature([
      PointsSnapshot,
      Settlement,
      Dividend,
      ReviewMeeting,
      ReviewVote,
      AuditLog,
      Tenant,
    ]),
  ],
  controllers: [BulletinController, PublicBulletinController],
  providers: [BulletinService],
  exports: [BulletinService],
})
export class BulletinModule {}
