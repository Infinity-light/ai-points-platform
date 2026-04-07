import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { Asset } from './entities/asset.entity';
import { AssetOperation } from './entities/asset-operation.entity';
import { AssetCodeSequence } from './entities/asset-code-sequence.entity';
import { AssetService } from './asset.service';
import { AssetController } from './asset.controller';
import { AssetExpiryProcessor } from './asset-expiry.processor';
import { QUEUE_NAMES } from '../queue/queue.constants';
import { RbacModule } from '../rbac/rbac.module';
import { ApprovalModule } from '../approval/approval.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Asset, AssetOperation, AssetCodeSequence]),
    BullModule.registerQueue({ name: QUEUE_NAMES.ASSET_EXPIRY }),
    RbacModule,
    forwardRef(() => ApprovalModule),
    NotificationModule,
  ],
  controllers: [AssetController],
  providers: [AssetService, AssetExpiryProcessor],
  exports: [AssetService],
})
export class AssetModule {}
