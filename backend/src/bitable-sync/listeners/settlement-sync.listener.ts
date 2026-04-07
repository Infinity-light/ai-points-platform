import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { BitableSyncService } from '../bitable-sync.service';

@Injectable()
export class SettlementBitableSyncListener {
  private readonly logger = new Logger(SettlementBitableSyncListener.name);

  constructor(private readonly bitableSyncService: BitableSyncService) {}

  @OnEvent('settlement.completed')
  async handleSettlementCompleted(event: {
    settlement: { id: string };
    tenantId: string;
    projectId: string;
  }): Promise<void> {
    try {
      await this.bitableSyncService.pushEntity(
        'settlement',
        event.tenantId,
        event.projectId,
        event.settlement.id,
      );
    } catch (err) {
      this.logger.error(
        `结算记录同步失败 (非致命): settlementId=${event.settlement.id}, ${String(err)}`,
      );
    }
  }
}
