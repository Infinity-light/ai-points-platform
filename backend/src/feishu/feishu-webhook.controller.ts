import {
  Controller,
  Post,
  Param,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Public } from '../auth/decorators/public.decorator';
import { FeishuConfigService } from './feishu-config.service';

interface FeishuWebhookBody {
  type?: string;
  challenge?: string;
  token?: string;
  encrypt?: string;
  header?: {
    event_type?: string;
    token?: string;
  };
  event?: Record<string, unknown>;
}

@Controller('feishu-webhook')
export class FeishuWebhookController {
  private readonly logger = new Logger(FeishuWebhookController.name);

  constructor(
    private readonly feishuConfigService: FeishuConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Public()
  @Post(':tenantId')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Param('tenantId') tenantId: string,
    @Body() body: FeishuWebhookBody,
    @Headers('x-lark-signature') signature?: string,
  ) {
    // URL verification challenge (Feishu sends type=url_verification on setup)
    if (body.type === 'url_verification') {
      this.logger.log(`飞书 Webhook URL 验证: tenantId=${tenantId}`);
      return { challenge: body.challenge };
    }

    // Verify token
    const config = await this.feishuConfigService.getConfig(tenantId);
    if (config?.webhookVerifyToken) {
      const token = body.token ?? body.header?.token;
      if (token && token !== config.webhookVerifyToken) {
        this.logger.warn(`飞书 Webhook token 验证失败: tenantId=${tenantId}`);
        return { code: 403, msg: 'token verification failed' };
      }
    }

    // Dispatch event asynchronously (must respond within 3s)
    if (body.type === 'event_callback' || body.header) {
      const eventType = body.header?.event_type ?? body.type;
      this.logger.log(`飞书 Webhook 事件: ${eventType}, tenantId=${tenantId}`);

      // Emit event for async processing
      this.eventEmitter.emit('feishu.webhook', {
        tenantId,
        event: body,
        eventType,
      });
    }

    return { code: 0, msg: 'success' };
  }
}
