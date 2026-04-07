import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { FeishuSyncService } from './feishu-sync.service';
import { WebhookRouterService } from '../bitable-sync/webhook-router.service';

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
    private readonly webhookRouter: WebhookRouterService,
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

      // Route to bitable sync via WebhookRouterService (generic multi-entity sync)
      if (eventType.includes('bitable') || eventType.includes('base')) {
        this.logger.log(`Bitable Webhook 事件: ${eventType}, tenantId=${tenantId}`);
        const eventBody = (event.event ?? event) as Record<string, unknown>;
        const appToken = eventBody['app_token'] as string | undefined;
        const tableId = eventBody['table_id'] as string | undefined;
        const records = (eventBody['records'] as Array<{ record_id?: string }>) ?? [];
        const eventId = (event.header as Record<string, unknown>)?.['event_id'] as string | undefined;

        if (appToken && tableId && records.length > 0) {
          const validRecords = records
            .filter((r) => r.record_id)
            .map((r) => ({ record_id: r.record_id! }));
          await this.webhookRouter.routeWebhook({ tenantId, appToken, tableId, records: validRecords, eventId });
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
}
