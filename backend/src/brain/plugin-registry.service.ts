import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BrainPlugin, BrainTool, BrainToolContext } from './interfaces/brain-plugin.interface';
import { BrainPluginConfig } from './entities/brain-plugin-config.entity';
import { CaslAbilityFactory, AppAction, AppResource } from '../rbac/casl-ability.factory';
import { TasksPlugin } from './plugins/builtin/tasks.plugin';
import { PointsPlugin } from './plugins/builtin/points.plugin';
import { MembersPlugin } from './plugins/builtin/members.plugin';
import { SubmissionsPlugin } from './plugins/builtin/submissions.plugin';
import { SettlementPlugin } from './plugins/builtin/settlement.plugin';
import { AuctionPlugin } from './plugins/builtin/auction.plugin';

export interface ResolvedTool {
  tool: BrainTool;
  pluginId: string;
}

@Injectable()
export class PluginRegistry implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PluginRegistry.name);
  private readonly plugins = new Map<string, BrainPlugin>();

  constructor(
    @InjectRepository(BrainPluginConfig)
    private readonly configRepo: Repository<BrainPluginConfig>,
    private readonly abilityFactory: CaslAbilityFactory,
    // Inject all builtin plugins
    private readonly tasksPlugin: TasksPlugin,
    private readonly pointsPlugin: PointsPlugin,
    private readonly membersPlugin: MembersPlugin,
    private readonly submissionsPlugin: SubmissionsPlugin,
    private readonly settlementPlugin: SettlementPlugin,
    private readonly auctionPlugin: AuctionPlugin,
  ) {}

  async onModuleInit(): Promise<void> {
    const builtins: BrainPlugin[] = [
      this.tasksPlugin,
      this.pointsPlugin,
      this.membersPlugin,
      this.submissionsPlugin,
      this.settlementPlugin,
      this.auctionPlugin,
    ];

    for (const plugin of builtins) {
      await this.register(plugin);
    }

    this.logger.log(
      `Registered ${this.plugins.size} plugins with ${this.getAllToolCount()} tools`,
    );
  }

  async onModuleDestroy(): Promise<void> {
    for (const plugin of this.plugins.values()) {
      try {
        await plugin.destroy();
      } catch (e) {
        this.logger.warn(`Error destroying plugin ${plugin.id}: ${e}`);
      }
    }
    this.plugins.clear();
  }

  async register(plugin: BrainPlugin): Promise<void> {
    await plugin.initialize({});
    this.plugins.set(plugin.id, plugin);
    this.logger.debug(`Registered plugin: ${plugin.id} (${plugin.tools.length} tools)`);
  }

  unregister(pluginId: string): void {
    this.plugins.delete(pluginId);
  }

  getPlugin(pluginId: string): BrainPlugin | undefined {
    return this.plugins.get(pluginId);
  }

  getAllPlugins(): BrainPlugin[] {
    return [...this.plugins.values()];
  }

  /**
   * Get all enabled tools for a tenant, filtered by RBAC permissions.
   * Builtin plugins are enabled by default (no config row needed).
   */
  async getEnabledTools(
    tenantId: string,
    _projectId: string,
    userId: string,
  ): Promise<ResolvedTool[]> {
    // Load config rows for this tenant
    const configs = await this.configRepo.find({ where: { tenantId } });
    const configMap = new Map(configs.map((c) => [c.pluginId, c]));

    // Build user ability for permission checks
    const ability = await this.abilityFactory.createForUser(userId, tenantId);

    const result: ResolvedTool[] = [];

    for (const plugin of this.plugins.values()) {
      const config = configMap.get(plugin.id);

      // Builtin plugins: enabled by default when no config row exists
      // Non-builtin plugins: must have an explicit enabled config
      if (plugin.type === 'builtin') {
        if (config && !config.enabled) continue; // explicitly disabled
      } else {
        if (!config || !config.enabled) continue; // must be explicitly enabled
      }

      for (const tool of plugin.tools) {
        // Filter out tools the user doesn't have permission for
        if (tool.requiredPermission) {
          const { resource, action } = tool.requiredPermission;
          if (!ability.can(action as AppAction, resource as AppResource)) continue;
        }
        result.push({ tool, pluginId: plugin.id });
      }
    }

    return result;
  }

  /**
   * Execute a tool by name, checking permissions first.
   */
  async executeTool(
    toolName: string,
    input: Record<string, unknown>,
    ctx: BrainToolContext,
  ): Promise<unknown> {
    for (const plugin of this.plugins.values()) {
      const tool = plugin.tools.find((t) => t.name === toolName);
      if (tool) {
        // Check permission
        if (tool.requiredPermission) {
          const ability = await this.abilityFactory.createForUser(
            ctx.userId,
            ctx.tenantId,
          );
          const { resource, action } = tool.requiredPermission;
          if (!ability.can(action as AppAction, resource as AppResource)) {
            throw new Error(`权限不足：需要 ${resource}:${action}`);
          }
        }
        return tool.call(input, ctx);
      }
    }
    throw new Error(`工具未找到: ${toolName}`);
  }

  private getAllToolCount(): number {
    let count = 0;
    for (const p of this.plugins.values()) count += p.tools.length;
    return count;
  }
}
