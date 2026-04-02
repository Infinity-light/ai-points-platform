import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { FeishuBitableSyncService } from './feishu-bitable-sync.service';

interface SettlementCompletedEvent {
  projectId: string;
  tenantId: string;
  settlementId: string;
  settledTaskIds: string[];
}

@Injectable()
export class FeishuBitableWritebackListener {
  private readonly logger = new Logger(FeishuBitableWritebackListener.name);

  constructor(private readonly bitableSyncService: FeishuBitableSyncService) {}

  @OnEvent('settlement.completed')
  async handleSettlementCompleted(event: SettlementCompletedEvent): Promise<void> {
    const { projectId, tenantId, settlementId, settledTaskIds } = event;
    this.logger.log(
      `收到结算完成事件: settlementId=${settlementId}, projectId=${projectId}, taskCount=${settledTaskIds.length}`,
    );

    try {
      await this.bitableSyncService.writebackPoints(projectId, tenantId, settledTaskIds);
    } catch (err) {
      this.logger.error(
        `回写飞书 Bitable 工分失败: settlementId=${settlementId}, ${String(err)}`,
        err instanceof Error ? err.stack : undefined,
      );
    }
  }
}
