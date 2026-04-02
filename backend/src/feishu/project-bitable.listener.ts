import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { FeishuBitableSyncService } from './feishu-bitable-sync.service';

interface ProjectCreatedEvent {
  projectId: string;
  tenantId: string;
  projectName: string;
}

@Injectable()
export class ProjectBitableListener {
  private readonly logger = new Logger(ProjectBitableListener.name);

  constructor(private readonly bitableSyncService: FeishuBitableSyncService) {}

  @OnEvent('project.created')
  async handleProjectCreated(event: ProjectCreatedEvent): Promise<void> {
    const { projectId, tenantId, projectName } = event;
    this.logger.log(
      `收到项目创建事件，尝试自动创建 Bitable: projectId=${projectId}, projectName=${projectName}`,
    );
    try {
      await this.bitableSyncService.createBitableForProject(projectId, tenantId, projectName);
    } catch (err) {
      // Non-fatal: project still works without Feishu table
      this.logger.error(
        `自动创建 Bitable 失败 (非致命): projectId=${projectId}, ${String(err)}`,
        err instanceof Error ? err.stack : undefined,
      );
    }
  }
}
