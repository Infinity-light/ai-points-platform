import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { BitableSyncService } from '../bitable-sync.service';

@Injectable()
export class UserBitableSyncListener {
  private readonly logger = new Logger(UserBitableSyncListener.name);

  constructor(private readonly bitableSyncService: BitableSyncService) {}

  @OnEvent('user.updated')
  async handleUserUpdated(event: { user: { id: string }; tenantId: string }): Promise<void> {
    try {
      await this.bitableSyncService.pushEntity('user', event.tenantId, '', event.user.id);
    } catch (err) {
      this.logger.error(`用户信息同步失败 (非致命): userId=${event.user.id}, ${String(err)}`);
    }
  }
}
