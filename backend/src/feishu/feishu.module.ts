import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { FeishuConfig } from './entities/feishu-config.entity';
import { FeishuRoleMapping } from './entities/feishu-role-mapping.entity';
import { FeishuSyncLog } from './entities/feishu-sync-log.entity';
import { User } from '../user/entities/user.entity';
import { UserRole } from '../rbac/entities/user-role.entity';
import { FeishuClientService } from './feishu-client.service';
import { FeishuConfigService } from './feishu-config.service';
import { FeishuSyncService } from './feishu-sync.service';
import { FeishuSyncProcessor } from './feishu-sync.processor';
import { FeishuDeviceFlowService } from './feishu-device-flow.service';
import { FeishuAutoConfigService } from './feishu-auto-config.service';
import { FeishuConfigController } from './feishu-config.controller';
import { FeishuWebhookController } from './feishu-webhook.controller';
import { RbacModule } from '../rbac/rbac.module';
import { DepartmentModule } from '../department/department.module';
import { AuthModule } from '../auth/auth.module';
import { QUEUE_NAMES } from '../queue/queue.constants';

@Module({
  imports: [
    TypeOrmModule.forFeature([FeishuConfig, FeishuRoleMapping, FeishuSyncLog, User, UserRole]),
    BullModule.registerQueue({ name: QUEUE_NAMES.FEISHU_SYNC }),
    RbacModule,
    DepartmentModule,
    forwardRef(() => AuthModule),
  ],
  controllers: [FeishuConfigController, FeishuWebhookController],
  providers: [
    FeishuClientService,
    FeishuConfigService,
    FeishuSyncService,
    FeishuSyncProcessor,
    FeishuDeviceFlowService,
    FeishuAutoConfigService,
  ],
  exports: [FeishuClientService, FeishuConfigService],
})
export class FeishuModule {}
