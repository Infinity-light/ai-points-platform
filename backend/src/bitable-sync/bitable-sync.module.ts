import { Module, OnModuleInit, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { FeishuBitableBinding } from '../feishu/entities/feishu-bitable-binding.entity';
import { FeishuBitableRecord } from '../feishu/entities/feishu-bitable-record.entity';
import { BitableSyncLog } from './entities/bitable-sync-log.entity';
import { Task } from '../task/entities/task.entity';
import { PointRecord } from '../points/entities/point-record.entity';
import { Settlement } from '../settlement/entities/settlement.entity';
import { User } from '../user/entities/user.entity';
import { Department } from '../department/entities/department.entity';
import { Asset } from '../asset/entities/asset.entity';
import { FeishuModule } from '../feishu/feishu.module';
import { RbacModule } from '../rbac/rbac.module';
import { QUEUE_NAMES } from '../queue/queue.constants';
import { BitableSyncController } from './bitable-sync.controller';
import { BitableSyncRegistryService } from './bitable-sync-registry.service';
import { FieldMapperService } from './field-mapper.service';
import { ConflictResolverService } from './conflict-resolver.service';
import { BatchSyncerService } from './batch-syncer.service';
import { WebhookRouterService } from './webhook-router.service';
import { BitableSyncService } from './bitable-sync.service';
import { BitableSyncProcessor } from './bitable-sync.processor';
import { TaskBitableAdapter } from './adapters/task.adapter';
import { PointRecordBitableAdapter } from './adapters/point-record.adapter';
import { SettlementBitableAdapter } from './adapters/settlement.adapter';
import { UserBitableAdapter } from './adapters/user.adapter';
import { DepartmentBitableAdapter } from './adapters/department.adapter';
import { AssetBitableAdapter } from './adapters/asset.adapter';
import { TaskBitableSyncListener } from './listeners/task-sync.listener';
import { PointRecordBitableSyncListener } from './listeners/point-record-sync.listener';
import { SettlementBitableSyncListener } from './listeners/settlement-sync.listener';
import { UserBitableSyncListener } from './listeners/user-sync.listener';
import { DepartmentBitableSyncListener } from './listeners/department-sync.listener';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      FeishuBitableBinding,
      FeishuBitableRecord,
      BitableSyncLog,
      Task,
      PointRecord,
      Settlement,
      User,
      Department,
      Asset,
    ]),
    BullModule.registerQueue({ name: QUEUE_NAMES.BITABLE_SYNC }),
    forwardRef(() => FeishuModule),
    RbacModule,
  ],
  controllers: [BitableSyncController],
  providers: [
    BitableSyncRegistryService,
    FieldMapperService,
    ConflictResolverService,
    BatchSyncerService,
    WebhookRouterService,
    BitableSyncService,
    BitableSyncProcessor,
    // Adapters
    TaskBitableAdapter,
    PointRecordBitableAdapter,
    SettlementBitableAdapter,
    UserBitableAdapter,
    DepartmentBitableAdapter,
    AssetBitableAdapter,
    // Listeners
    TaskBitableSyncListener,
    PointRecordBitableSyncListener,
    SettlementBitableSyncListener,
    UserBitableSyncListener,
    DepartmentBitableSyncListener,
  ],
  exports: [
    BitableSyncService,
    BitableSyncRegistryService,
    FieldMapperService,
    WebhookRouterService,
  ],
})
export class BitableSyncModule implements OnModuleInit {
  constructor(
    private readonly registry: BitableSyncRegistryService,
    private readonly taskAdapter: TaskBitableAdapter,
    private readonly assetAdapter: AssetBitableAdapter,
    private readonly pointRecordAdapter: PointRecordBitableAdapter,
    private readonly settlementAdapter: SettlementBitableAdapter,
    private readonly userAdapter: UserBitableAdapter,
    private readonly departmentAdapter: DepartmentBitableAdapter,
  ) {}

  onModuleInit(): void {
    this.registry.register(this.taskAdapter);
    this.registry.register(this.assetAdapter);
    this.registry.register(this.pointRecordAdapter);
    this.registry.register(this.settlementAdapter);
    this.registry.register(this.userAdapter);
    this.registry.register(this.departmentAdapter);
  }
}
