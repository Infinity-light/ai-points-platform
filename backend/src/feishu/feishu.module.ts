import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { FeishuConfig } from './entities/feishu-config.entity';
import { FeishuRoleMapping } from './entities/feishu-role-mapping.entity';
import { FeishuSyncLog } from './entities/feishu-sync-log.entity';
import { FeishuBitableBinding } from './entities/feishu-bitable-binding.entity';
import { FeishuBitableRecord } from './entities/feishu-bitable-record.entity';
import { User } from '../user/entities/user.entity';
import { UserRole } from '../rbac/entities/user-role.entity';
import { Task } from '../task/entities/task.entity';
import { FeishuClientService } from './feishu-client.service';
import { FeishuConfigService } from './feishu-config.service';
import { FeishuSyncService } from './feishu-sync.service';
import { FeishuSyncProcessor } from './feishu-sync.processor';
import { FeishuAutoConfigService } from './feishu-auto-config.service';
import { FeishuBitableSyncService } from './feishu-bitable-sync.service';
import { FeishuBitableSyncProcessor } from './feishu-bitable-sync.processor';
import { FeishuWebhookListener } from './feishu-webhook.listener';
import { FeishuBitableWritebackListener } from './feishu-bitable-writeback.listener';
import { ProjectBitableListener } from './project-bitable.listener';
import { TaskFeishuSyncListener } from './task-feishu-sync.listener';
import { FeishuConfigController } from './feishu-config.controller';
import { FeishuWebhookController } from './feishu-webhook.controller';
import { FeishuBitableController } from './feishu-bitable.controller';
import { RbacModule } from '../rbac/rbac.module';
import { DepartmentModule } from '../department/department.module';
import { AuthModule } from '../auth/auth.module';
import { TaskModule } from '../task/task.module';
import { BitableSyncModule } from '../bitable-sync/bitable-sync.module';
import { QUEUE_NAMES } from '../queue/queue.constants';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      FeishuConfig,
      FeishuRoleMapping,
      FeishuSyncLog,
      FeishuBitableBinding,
      FeishuBitableRecord,
      User,
      UserRole,
      Task,
    ]),
    BullModule.registerQueue({ name: QUEUE_NAMES.FEISHU_SYNC }),
    BullModule.registerQueue({ name: QUEUE_NAMES.FEISHU_BITABLE_SYNC }),
    RbacModule,
    DepartmentModule,
    forwardRef(() => AuthModule),
    forwardRef(() => TaskModule),
    forwardRef(() => BitableSyncModule),
  ],
  controllers: [FeishuConfigController, FeishuWebhookController, FeishuBitableController],
  providers: [
    FeishuClientService,
    FeishuConfigService,
    FeishuSyncService,
    FeishuSyncProcessor,
    FeishuAutoConfigService,
    FeishuBitableSyncService,
    FeishuBitableSyncProcessor,
    FeishuWebhookListener,
    FeishuBitableWritebackListener,
    ProjectBitableListener,
    TaskFeishuSyncListener,
  ],
  exports: [FeishuClientService, FeishuConfigService, FeishuBitableSyncService],
})
export class FeishuModule {}
