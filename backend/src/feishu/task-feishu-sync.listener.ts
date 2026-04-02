import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Task } from '../task/entities/task.entity';
import { FeishuBitableSyncService } from './feishu-bitable-sync.service';

interface TaskEvent {
  task: Task;
  tenantId: string;
}

@Injectable()
export class TaskFeishuSyncListener {
  private readonly logger = new Logger(TaskFeishuSyncListener.name);

  constructor(private readonly bitableSyncService: FeishuBitableSyncService) {}

  @OnEvent('task.created')
  async handleTaskCreated(event: TaskEvent): Promise<void> {
    const { task, tenantId } = event;
    try {
      await this.bitableSyncService.syncTaskToFeishu(task, tenantId);
    } catch (err) {
      this.logger.error(
        `同步新任务到 Bitable 失败 (非致命): taskId=${task.id}, ${String(err)}`,
        err instanceof Error ? err.stack : undefined,
      );
    }
  }

  @OnEvent('task.updated')
  async handleTaskUpdated(event: TaskEvent): Promise<void> {
    const { task, tenantId } = event;
    try {
      await this.bitableSyncService.syncTaskToFeishu(task, tenantId);
    } catch (err) {
      this.logger.error(
        `同步任务更新到 Bitable 失败 (非致命): taskId=${task.id}, ${String(err)}`,
        err instanceof Error ? err.stack : undefined,
      );
    }
  }
}
