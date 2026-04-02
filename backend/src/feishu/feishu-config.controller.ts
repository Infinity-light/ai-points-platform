import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { PoliciesGuard } from '../rbac/policies.guard';
import { CheckPolicies } from '../rbac/decorators/check-policies.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { FeishuConfigService } from './feishu-config.service';
import { FeishuSyncService } from './feishu-sync.service';
import { FeishuAutoConfigService } from './feishu-auto-config.service';
import { CreateFeishuConfigDto } from './dto/create-feishu-config.dto';
import { CreateRoleMappingDto } from './dto/create-role-mapping.dto';
import { QUEUE_NAMES } from '../queue/queue.constants';
import { FEISHU_FULL_SYNC_JOB } from './feishu-sync.processor';
import { ConfigService } from '@nestjs/config';

interface RequestWithUser extends Request {
  user: JwtPayload;
}

@Controller('feishu-config')
@UseGuards(PoliciesGuard)
@CheckPolicies('feishu', 'manage')
export class FeishuConfigController {
  constructor(
    private readonly feishuConfigService: FeishuConfigService,
    private readonly feishuSyncService: FeishuSyncService,
    private readonly feishuAutoConfigService: FeishuAutoConfigService,
    @InjectQueue(QUEUE_NAMES.FEISHU_SYNC)
    private readonly feishuSyncQueue: Queue,
    private readonly configService: ConfigService,
  ) {}

  @Get()
  async getConfig(@Request() req: RequestWithUser) {
    const tenantId = req.user.tenantId;
    const config = await this.feishuConfigService.getConfig(tenantId);
    if (!config) {
      return { appId: null, enabled: false, webhookUrl: null, webhookVerifyToken: null, hasSecret: false };
    }
    const baseUrl = this.configService.get<string>('feishu.callbackUrl')?.replace('/auth/feishu/callback', '') ?? '';
    return {
      appId: config.appId,
      enabled: config.enabled,
      webhookUrl: this.feishuConfigService.getWebhookUrl(tenantId, baseUrl),
      webhookVerifyToken: config.webhookVerifyToken,
      hasSecret: true,
    };
  }

  @Post()
  async saveConfig(
    @Request() req: RequestWithUser,
    @Body() dto: CreateFeishuConfigDto,
  ) {
    const tenantId = req.user.tenantId;
    const baseUrl = this.configService.get<string>('feishu.callbackUrl')?.replace('/auth/feishu/callback', '') ?? '';
    const config = await this.feishuConfigService.saveConfig(tenantId, dto, baseUrl);
    return {
      appId: config.appId,
      enabled: config.enabled,
      webhookUrl: this.feishuConfigService.getWebhookUrl(tenantId, baseUrl),
      webhookVerifyToken: config.webhookVerifyToken,
    };
  }

  @Post('test-connection')
  @HttpCode(HttpStatus.OK)
  async testConnection(@Request() req: RequestWithUser) {
    const result = await this.feishuConfigService.testConnection(req.user.tenantId);
    return result;
  }

  @Get('role-mappings')
  async listMappings(@Request() req: RequestWithUser) {
    const items = await this.feishuConfigService.listMappings(req.user.tenantId);
    return { items };
  }

  @Post('role-mappings')
  async createMapping(
    @Request() req: RequestWithUser,
    @Body() dto: CreateRoleMappingDto,
  ) {
    return this.feishuConfigService.createMapping(req.user.tenantId, dto);
  }

  @Delete('role-mappings/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteMapping(
    @Param('id') id: string,
    @Request() req: RequestWithUser,
  ) {
    await this.feishuConfigService.deleteMapping(req.user.tenantId, id);
  }

  @Post('sync')
  @HttpCode(HttpStatus.ACCEPTED)
  async triggerSync(@Request() req: RequestWithUser) {
    const tenantId = req.user.tenantId;
    const jobId = `feishu-full-sync-${tenantId}-${Date.now()}`;
    const job = await this.feishuSyncQueue.add(
      FEISHU_FULL_SYNC_JOB,
      { tenantId },
      { jobId },
    );
    return { jobId: job.id, message: '同步任务已创建' };
  }

  @Get('sync-logs')
  async getSyncLogs(
    @Request() req: RequestWithUser,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.feishuSyncService.getSyncLogs(
      req.user.tenantId,
      parseInt(page, 10),
      parseInt(limit, 10),
    );
  }

  // ─── Auto Configuration ────────────────────────────────────────────────────

  @Post('auto-configure')
  @HttpCode(HttpStatus.OK)
  async autoConfigure(@Request() req: RequestWithUser) {
    const tenantId = req.user.tenantId;
    const baseUrl = this.configService.get<string>('feishu.callbackUrl')?.replace('/auth/feishu/callback', '') ?? '';
    const webhookUrl = this.feishuConfigService.getWebhookUrl(tenantId, baseUrl);
    return this.feishuAutoConfigService.autoConfigureAll(tenantId, webhookUrl);
  }

  @Get('check-scopes')
  async checkScopes(@Request() req: RequestWithUser) {
    return this.feishuAutoConfigService.checkScopes(req.user.tenantId);
  }
}
