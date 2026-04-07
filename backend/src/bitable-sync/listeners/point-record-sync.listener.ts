import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { BitableSyncService } from '../bitable-sync.service';

@Injectable()
export class PointRecordBitableSyncListener {
  private readonly logger = new Logger(PointRecordBitableSyncListener.name);

  constructor(private readonly bitableSyncService: BitableSyncService) {}

  @OnEvent('points.awarded')
  async handlePointsAwarded(event: {
    pointRecord: { id: string; projectId: string };
    tenantId: string;
  }): Promise<void> {
    try {
      await this.bitableSyncService.pushEntity(
        'point_record',
        event.tenantId,
        event.pointRecord.projectId,
        event.pointRecord.id,
      );
    } catch (err) {
      this.logger.error(
        `工分记录同步失败 (非致命): pointRecordId=${event.pointRecord.id}, ${String(err)}`,
      );
    }
  }
}
