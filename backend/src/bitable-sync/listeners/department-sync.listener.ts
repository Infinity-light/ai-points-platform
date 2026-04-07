import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { BitableSyncService } from '../bitable-sync.service';

@Injectable()
export class DepartmentBitableSyncListener {
  private readonly logger = new Logger(DepartmentBitableSyncListener.name);

  constructor(private readonly bitableSyncService: BitableSyncService) {}

  @OnEvent('department.updated')
  async handleDepartmentUpdated(event: {
    department: { id: string };
    tenantId: string;
  }): Promise<void> {
    try {
      await this.bitableSyncService.pushEntity(
        'department',
        event.tenantId,
        '',
        event.department.id,
      );
    } catch (err) {
      this.logger.error(
        `部门信息同步失败 (非致命): departmentId=${event.department.id}, ${String(err)}`,
      );
    }
  }
}
