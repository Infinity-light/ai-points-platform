import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Request,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { PoliciesGuard } from '../rbac/policies.guard';
import { CheckPolicies } from '../rbac/decorators/check-policies.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { FeishuBitableSyncService } from './feishu-bitable-sync.service';
import { BitableFieldMapping } from './entities/feishu-bitable-binding.entity';
import { QUEUE_NAMES } from '../queue/queue.constants';
import { BITABLE_FULL_SYNC_JOB, BitableSyncJobData } from './feishu-bitable-sync.processor';

interface RequestWithUser extends Request {
  user: JwtPayload;
}

@Controller('projects/:projectId/bitable')
@UseGuards(PoliciesGuard)
export class FeishuBitableController {
  private readonly logger = new Logger(FeishuBitableController.name);

  constructor(
    private readonly bitableSyncService: FeishuBitableSyncService,
    @InjectQueue(QUEUE_NAMES.FEISHU_BITABLE_SYNC)
    private readonly syncQueue: Queue,
  ) {}

  @Post('fetch-fields')
  @CheckPolicies('projects', 'update')
  async fetchFields(
    @Param('projectId') projectId: string,
    @Request() req: RequestWithUser,
    @Body() body: { appToken: string; tableId: string },
  ) {
    const tenantId = req.user.tenantId;
    const fields = await this.bitableSyncService.fetchTableFields(
      tenantId,
      body.appToken,
      body.tableId,
    );
    return { fields };
  }

  @Post('binding')
  @CheckPolicies('projects', 'update')
  async createBinding(
    @Param('projectId') projectId: string,
    @Request() req: RequestWithUser,
    @Body()
    body: {
      appToken: string;
      tableId: string;
      fieldMapping: BitableFieldMapping;
      writebackFieldId?: string | null;
    },
  ) {
    const tenantId = req.user.tenantId;
    const binding = await this.bitableSyncService.saveBinding(tenantId, projectId, {
      appToken: body.appToken,
      tableId: body.tableId,
      fieldMapping: body.fieldMapping,
      writebackFieldId: body.writebackFieldId ?? null,
    });

    // Enqueue a full sync job
    const jobId = `bitable-full-sync-${binding.id}-${Date.now()}`;
    const jobData: BitableSyncJobData = { bindingId: binding.id, tenantId };
    const job = await this.syncQueue.add(BITABLE_FULL_SYNC_JOB, jobData, { jobId });
    this.logger.log(`Bitable 全量同步任务已入队: jobId=${job.id}, bindingId=${binding.id}`);

    return { binding, jobId: job.id };
  }

  @Get('binding')
  async getBinding(
    @Param('projectId') projectId: string,
    @Request() req: RequestWithUser,
  ) {
    const tenantId = req.user.tenantId;
    const binding = await this.bitableSyncService.getBinding(projectId, tenantId);
    const embedUrl = binding
      ? `https://feishu.cn/base/${binding.appToken}?table=${binding.tableId}`
      : null;
    return { binding, embedUrl };
  }

  @Delete('binding')
  @CheckPolicies('projects', 'update')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteBinding(
    @Param('projectId') projectId: string,
    @Request() req: RequestWithUser,
  ) {
    const tenantId = req.user.tenantId;
    await this.bitableSyncService.deleteBinding(projectId, tenantId);
  }

  @Post('sync')
  @CheckPolicies('projects', 'update')
  @HttpCode(HttpStatus.ACCEPTED)
  async triggerSync(
    @Param('projectId') projectId: string,
    @Request() req: RequestWithUser,
  ) {
    const tenantId = req.user.tenantId;
    const binding = await this.bitableSyncService.getBinding(projectId, tenantId);
    if (!binding) {
      return { message: '该项目尚未配置 Bitable 绑定' };
    }

    const jobId = `bitable-full-sync-${binding.id}-${Date.now()}`;
    const jobData: BitableSyncJobData = { bindingId: binding.id, tenantId };
    const job = await this.syncQueue.add(BITABLE_FULL_SYNC_JOB, jobData, { jobId });
    this.logger.log(`手动触发 Bitable 全量同步: jobId=${job.id}, bindingId=${binding.id}`);

    return { jobId: job.id, message: '同步任务已创建' };
  }
}
