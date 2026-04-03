import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Body,
  Request,
  UseGuards,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PluginRegistry } from './plugin-registry.service';
import { BrainPluginConfig } from './entities/brain-plugin-config.entity';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { PoliciesGuard } from '../rbac/policies.guard';
import { CheckPolicies } from '../rbac/decorators/check-policies.decorator';

interface RequestWithUser extends Request {
  user: JwtPayload;
}

@Controller('brain/plugins')
@UseGuards(PoliciesGuard)
@CheckPolicies('config', 'manage')
export class PluginAdminController {
  constructor(
    private readonly pluginRegistry: PluginRegistry,
    @InjectRepository(BrainPluginConfig)
    private readonly configRepo: Repository<BrainPluginConfig>,
  ) {}

  /**
   * List all registered plugins with their config status for the current tenant.
   */
  @Get()
  async listPlugins(@Request() req: RequestWithUser) {
    const tenantId = req.user.tenantId;
    const plugins = this.pluginRegistry.getAllPlugins();
    const configs = await this.configRepo.find({ where: { tenantId } });
    const configMap = new Map(configs.map((c) => [c.pluginId, c]));

    return plugins.map((plugin) => {
      const config = configMap.get(plugin.id);
      return {
        id: plugin.id,
        name: plugin.name,
        type: plugin.type,
        toolCount: plugin.tools.length,
        tools: plugin.tools.map((t) => ({
          name: t.name,
          description: t.description,
          requiredPermission: t.requiredPermission,
        })),
        enabled: config ? config.enabled : plugin.type === 'builtin', // builtin default enabled
        config: config?.config ?? {},
      };
    });
  }

  /**
   * Enable/disable a plugin or update its config for the current tenant.
   */
  @Patch(':pluginId')
  async updatePluginConfig(
    @Param('pluginId') pluginId: string,
    @Body() body: { enabled?: boolean; config?: Record<string, unknown> },
    @Request() req: RequestWithUser,
  ) {
    const tenantId = req.user.tenantId;

    let configRow = await this.configRepo.findOne({
      where: { tenantId, pluginId },
    });

    if (configRow) {
      if (body.enabled !== undefined) configRow.enabled = body.enabled;
      if (body.config !== undefined) configRow.config = body.config;
    } else {
      const plugin = this.pluginRegistry.getPlugin(pluginId);
      configRow = this.configRepo.create({
        tenantId,
        pluginId,
        type: plugin?.type ?? 'custom',
        enabled: body.enabled ?? true,
        config: body.config ?? {},
      });
    }

    await this.configRepo.save(configRow);
    return { pluginId, enabled: configRow.enabled, config: configRow.config };
  }

  /**
   * Test a tool by executing it with sample input.
   */
  @Post(':pluginId/test')
  async testTool(
    @Param('pluginId') pluginId: string,
    @Body() body: { toolName: string; input?: Record<string, unknown> },
    @Request() req: RequestWithUser,
  ) {
    const plugin = this.pluginRegistry.getPlugin(pluginId);
    if (!plugin) {
      return { error: `Plugin ${pluginId} not found` };
    }

    const tool = plugin.tools.find((t) => t.name === body.toolName);
    if (!tool) {
      return { error: `Tool ${body.toolName} not found in plugin ${pluginId}` };
    }

    try {
      const result = await tool.call(body.input ?? {}, {
        tenantId: req.user.tenantId,
        projectId: '',
        userId: req.user.sub,
      });
      return { success: true, result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
