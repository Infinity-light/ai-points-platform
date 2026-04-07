import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApprovalConfig } from './entities/approval-config.entity';
import { ApprovalInstance } from './entities/approval-instance.entity';
import { ApprovalRecord } from './entities/approval-record.entity';
import { ApprovalService } from './approval.service';
import { ApprovalController } from './approval.controller';
import { RbacModule } from '../rbac/rbac.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ApprovalConfig, ApprovalInstance, ApprovalRecord]),
    RbacModule,
    NotificationModule,
  ],
  controllers: [ApprovalController],
  providers: [ApprovalService],
  exports: [ApprovalService],
})
export class ApprovalModule {}
