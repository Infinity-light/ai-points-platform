import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { DatabaseModule } from './database/database.module';
import { QueueModule } from './queue/queue.module';
import { TenantModule } from './tenant/tenant.module';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { InviteModule } from './invite/invite.module';
import { ProjectModule } from './project/project.module';
import { TaskModule } from './task/task.module';
import { AiModule } from './ai/ai.module';
import { UploadModule } from './upload/upload.module';
import { SubmissionModule } from './submission/submission.module';
import { WebhookModule } from './webhook/webhook.module';
import { PointsModule } from './points/points.module';
import { VoteModule } from './vote/vote.module';
import { SettlementModule } from './settlement/settlement.module';
import { BrainModule } from './brain/brain.module';
import { AdminModule } from './admin/admin.module';
import { SuperAdminModule } from './super-admin/super-admin.module';
import { NotificationModule } from './notification/notification.module';
import { DividendModule } from './dividend/dividend.module';
import { SkillModule } from './skill/skill.module';
import { RbacModule } from './rbac/rbac.module';
import { AuditModule } from './audit/audit.module';
import { MeetingModule } from './meeting/meeting.module';
import { AuctionModule } from './auction/auction.module';
import { BulletinModule } from './bulletin/bulletin.module';
import { AiConfigModule } from './ai-config/ai-config.module';
import { DepartmentModule } from './department/department.module';
import { FeishuModule } from './feishu/feishu.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import databaseConfig from './config/database.config';
import redisConfig from './config/redis.config';
import authConfig from './config/auth.config';
import aiConfig from './config/ai.config';
import feishuConfig from './config/feishu.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, redisConfig, authConfig, aiConfig, feishuConfig],
      envFilePath: '.env',
    }),
    DatabaseModule,
    QueueModule,
    TenantModule,
    UserModule,
    AuthModule,
    InviteModule,
    ProjectModule,
    TaskModule,
    AiModule,
    UploadModule,
    SubmissionModule,
    WebhookModule,
    PointsModule,
    VoteModule,
    SettlementModule,
    BrainModule,
    AdminModule,
    SuperAdminModule,
    NotificationModule,
    DividendModule,
    SkillModule,
    RbacModule,
    AuditModule,
    MeetingModule,
    AuctionModule,
    BulletinModule,
    AiConfigModule,
    DepartmentModule,
    FeishuModule,
    EventEmitterModule.forRoot(),
  ],
  controllers: [AppController],
})
export class AppModule {}
