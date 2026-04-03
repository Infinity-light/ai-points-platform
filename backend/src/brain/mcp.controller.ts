import {
  Controller,
  Get,
  Post,
  Req,
  Res,
  Query,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { OpenApiKeyService } from '../ai-config/open-api-key.service';
import { PluginRegistry } from './plugin-registry.service';

// Dynamic require for MCP SDK sub-path modules (avoids TS module resolution issues with .js exports)
/* eslint-disable @typescript-eslint/no-require-imports */
const McpServerModule = require('@modelcontextprotocol/sdk/server/mcp.js');
const SseModule = require('@modelcontextprotocol/sdk/server/sse.js');
/* eslint-enable @typescript-eslint/no-require-imports */

@Controller('mcp')
@Public()
export class McpController implements OnModuleInit {
  private readonly logger = new Logger(McpController.name);
  private readonly transports = new Map<string, any>();

  constructor(
    private readonly openApiKeyService: OpenApiKeyService,
    private readonly pluginRegistry: PluginRegistry,
  ) {}

  async onModuleInit(): Promise<void> {
    this.logger.log('MCP endpoint initialized at /mcp');
  }

  /**
   * SSE handshake — client connects here to receive events.
   */
  @Get()
  async handleSseHandshake(
    @Req() req: Request,
    @Res() res: Response,
    @Query('projectId') projectId?: string,
  ): Promise<void> {
    // Authenticate via X-API-Key
    const auth = await this.authenticate(req);
    if (!auth) {
      res.status(401).json({ error: 'Invalid or missing API key' });
      return;
    }

    const transport = new SseModule.SSEServerTransport('/mcp', res);
    this.transports.set(transport.sessionId, transport);

    // Create a per-session MCP server
    const server = new McpServerModule.McpServer({
      name: 'ai-points-platform',
      version: '1.0.0',
    });

    // Register tools from plugin registry
    const resolvedTools = await this.pluginRegistry.getEnabledTools(
      auth.tenantId,
      projectId ?? '',
      auth.userId,
    );

    for (const { tool } of resolvedTools) {
      server.tool(
        tool.name,
        tool.description,
        tool.inputSchema.properties,
        async (params: Record<string, unknown>) => {
          try {
            const result = await tool.call(params, {
              tenantId: auth.tenantId,
              projectId: projectId ?? '',
              userId: auth.userId,
            });
            return {
              content: [{ type: 'text' as const, text: JSON.stringify(result) }],
            };
          } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            return {
              content: [{ type: 'text' as const, text: JSON.stringify({ error: msg }) }],
              isError: true,
            };
          }
        },
      );
    }

    // Clean up on disconnect
    req.on('close', () => {
      this.transports.delete(transport.sessionId);
    });

    await server.connect(transport);
  }

  /**
   * POST endpoint — client sends MCP JSON-RPC messages here.
   */
  @Post()
  async handleMessage(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const sessionId = req.query.sessionId as string;
    const transport = this.transports.get(sessionId);

    if (!transport) {
      res.status(400).json({ error: 'Unknown session. Connect via GET /mcp first.' });
      return;
    }

    await transport.handlePostMessage(req, res);
  }

  /**
   * Authenticate via X-API-Key header.
   */
  private async authenticate(
    req: Request,
  ): Promise<{ tenantId: string; userId: string } | null> {
    const apiKey = req.headers['x-api-key'] as string | undefined;
    if (!apiKey) return null;

    const key = await this.openApiKeyService.validateKey(apiKey);
    if (!key) return null;

    return { tenantId: key.tenantId, userId: key.createdBy };
  }
}
