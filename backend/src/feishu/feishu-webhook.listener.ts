import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { FeishuSyncService } from './feishu-sync.service';
import { FeishuBitableSyncService } from './feishu-bitable-sync.service';

interface FeishuWebhookPayload {
  tenantId: string;
  event: Record<string, unknown>;
  eventType: string | undefined;
}

@Injectable()
export class FeishuWebhookListener {
  private readonly logger = new Logger(FeishuWebhookListener.name);

  constructor(
    private readonly syncService: FeishuSyncService,
    private readonly bitableSyncService: FeishuBitableSyncService,
  ) {}

  @OnEvent('feishu.webhook')
  async handleWebhook(payload: FeishuWebhookPayload): Promise<void> {
    const { tenantId, event, eventType } = payload;

    if (!eventType) {
      this.logger.warn(`收到无类型的飞书 Webhook 事件: tenantId=${tenantId}`);
      return;
    }

    try {
      // Route to contacts sync for contact events
      if (eventType.startsWith('contact.')) {
        await this.syncService.processWebhookEvent(tenantId, event);
        return;
      }

      // Route to bitable sync for bitable/drive events
      if (eventType.includes('bitable') || eventType.includes('base')) {
        this.logger.log(`Bitable Webhook 事件: ${eventType}, tenantId=${tenantId}`);
        // Extract record info from event payload and trigger incremental sync
        // Feishu bitable record change event may look like:
        // { header: { event_type: 'drive.file.bitable_record_changed_v1' }, event: { app_token, table_id, records: [...] } }
        const eventBody = (event.event ?? event) as Record<string, unknown>;
        const appToken = eventBody['app_token'] as string | undefined;
        const tableId = eventBody['table_id'] as string | undefined;
        const records = (eventBody['records'] as Array<{ record_id?: string }>) ?? [];

        if (appToken && tableId && records.length > 0) {
          // Find binding by appToken + tableId
          for (const record of records) {
            if (!record.record_id) continue;
            // Look up binding lazily — we don't have projectId here, search by appToken+tableId
            // This is handled inside syncSingleRecord via binding lookup
            this.logger.log(
              `Bitable 增量同步: appToken=${appToken}, tableId=${tableId}, recordId=${record.record_id}`,
            );
            // We cannot look up bindingId without a projectId; trigger a search by appToken+tableId
            await this.syncByAppTokenTableId(tenantId, appToken, tableId, record.record_id);
          }
        }
        return;
      }

      this.logger.debug(`未处理的飞书 Webhook 事件类型: ${eventType}`);
    } catch (err) {
      this.logger.error(
        `飞书 Webhook 事件处理失败: ${eventType}, tenantId=${tenantId}, ${String(err)}`,
      );
    }
  }

  private async syncByAppTokenTableId(
    tenantId: string,
    appToken: string,
    tableId: string,
    recordId: string,
  ): Promise<void> {
    // Delegate single record sync using the service's internal lookup
    // The service will find the binding by appToken + tableId + tenantId
    await this.bitableSyncService.syncSingleRecordByTable(
      tenantId,
      appToken,
      tableId,
      recordId,
    );
  }
}
