import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BrainService } from './brain.service';
import { BrainController } from './brain.controller';
import { McpController } from './mcp.controller';
import { PluginAdminController } from './plugin-admin.controller';
import { BrainConversation } from './entities/brain-conversation.entity';
import { BrainPluginConfig } from './entities/brain-plugin-config.entity';
import { ProjectModule } from '../project/project.module';
import { AiConfigModule } from '../ai-config/ai-config.module';
import { RbacModule } from '../rbac/rbac.module';
import { BuiltinPluginsModule } from './plugins/builtin/builtin-plugins.module';
import { PluginRegistry } from './plugin-registry.service';
import { LarkCliPlugin } from './plugins/lark-cli/lark-cli.plugin';

@Module({
  imports: [
    TypeOrmModule.forFeature([BrainConversation, BrainPluginConfig]),
    ProjectModule,
    AiConfigModule,
    RbacModule,
    BuiltinPluginsModule,
  ],
  controllers: [BrainController, McpController, PluginAdminController],
  providers: [BrainService, PluginRegistry, LarkCliPlugin],
  exports: [BrainService, PluginRegistry],
})
export class BrainModule {}
