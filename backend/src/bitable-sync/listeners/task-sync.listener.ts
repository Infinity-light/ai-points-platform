import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { BitableSyncService } from '../bitable-sync.service';

@Injectable()
export class TaskBitableSyncListener {
  private readonly logger = new Logger(TaskBitableSyncListener.name);

  constructor(private readonly bitableSyncService: BitableSyncService) {}

  @OnEvent('task.created')
  async handleTaskCreated(event: {
    task: { id: string; projectId: string };
    tenantId: string;
  }): Promise<void> {
    try {
      await this.bitableSyncService.pushEntity(
        'task',
        event.tenantId,
        event.task.projectId,
        event.task.id,
      );
    } catch (err) {
      this.logger.error(`任务创建同步失败 (非致命): taskId=${event.task.id}, ${String(err)}`);
    }
  }

  @OnEvent('task.updated')
  async handleTaskUpdated(event: {
    task: { id: string; projectId: string };
    tenantId: string;
  }): Promise<void> {
    try {
      await this.bitableSyncService.pushEntity(
        'task',
        event.tenantId,
        event.task.projectId,
        event.task.id,
      );
    } catch (err) {
      this.logger.error(`任务更新同步失败 (非致命): taskId=${event.task.id}, ${String(err)}`);
    }
  }
}
