import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { FeishuBitableBinding } from '../feishu/entities/feishu-bitable-binding.entity';
import { FeishuBitableRecord } from '../feishu/entities/feishu-bitable-record.entity';
import { QUEUE_NAMES } from '../queue/queue.constants';

export interface WebhookRecord {
  record_id: string;
}

@Injectable()
export class WebhookRouterService {
  private readonly logger = new Logger(WebhookRouterService.name);

  constructor(
    @InjectRepository(FeishuBitableBinding)
    private readonly bindingRepo: Repository<FeishuBitableBinding>,
    @InjectRepository(FeishuBitableRecord)
    private readonly recordRepo: Repository<FeishuBitableRecord>,
    @InjectQueue(QUEUE_NAMES.BITABLE_SYNC)
    private readonly syncQueue: Queue,
  ) {}

  async findBindings(
    tenantId: string,
    appToken: string,
    tableId: string,
  ): Promise<FeishuBitableBinding[]> {
    return this.bindingRepo.find({
      where: { tenantId, appToken, tableId, isActive: true },
    });
  }

  async enqueueRecordSync(
    binding: FeishuBitableBinding,
    tenantId: string,
    recordId: string,
    eventId?: string,
  ): Promise<void> {
    // Idempotency check: if this eventId was already processed, skip
    if (eventId) {
      const existing = await this.recordRepo.findOne({
        where: { bindingId: binding.id, feishuRecordId: recordId, lastEventId: eventId },
      });
      if (existing) {
        this.logger.debug(
          `enqueueRecordSync: 事件 ${eventId} 已处理，跳过 recordId=${recordId}`,
        );
        return;
      }
    }

    await this.syncQueue.add('record-sync', {
      bindingId: binding.id,
      tenantId,
      recordId,
      eventId,
    });

    this.logger.debug(
      `enqueueRecordSync: 已入队 recordId=${recordId}, bindingId=${binding.id}`,
    );
  }

  async routeWebhook(opts: {
    tenantId: string;
    appToken: string;
    tableId: string;
    records: WebhookRecord[];
    eventId?: string;
  }): Promise<void> {
    const { tenantId, appToken, tableId, records, eventId } = opts;
    const bindings = await this.findBindings(tenantId, appToken, tableId);

    if (bindings.length === 0) {
      this.logger.debug(
        `routeWebhook: 未找到匹配 binding for appToken=${appToken}, tableId=${tableId}`,
      );
      return;
    }

    for (const binding of bindings) {
      // Ignore incoming webhooks for push-only bindings
      if (binding.syncDirection === 'push_only') {
        this.logger.debug(
          `routeWebhook: binding ${binding.id} 为 push_only，跳过 webhook 入队`,
        );
        continue;
      }

      for (const record of records) {
        if (!record.record_id) continue;
        try {
          await this.enqueueRecordSync(binding, tenantId, record.record_id, eventId);
        } catch (err) {
          this.logger.error(
            `routeWebhook: 入队失败 recordId=${record.record_id}, ${String(err)}`,
          );
        }
      }
    }
  }
}
