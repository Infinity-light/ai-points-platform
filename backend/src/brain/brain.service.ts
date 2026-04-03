import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { BrainConversation, ChatMessage } from './entities/brain-conversation.entity';
import { ProjectService } from '../project/project.service';
import { AiProviderService } from '../ai-config/ai-provider.service';
import { PluginRegistry } from './plugin-registry.service';
import { ToolCallRecord } from './interfaces/brain-plugin.interface';
import { Response } from 'express';

@Injectable()
export class BrainService {
  private readonly logger = new Logger(BrainService.name);

  constructor(
    @InjectRepository(BrainConversation)
    private readonly conversationRepository: Repository<BrainConversation>,
    private readonly projectService: ProjectService,
    private readonly configService: ConfigService,
    private readonly aiProviderService: AiProviderService,
    private readonly pluginRegistry: PluginRegistry,
  ) {}

  // ── Anthropic client resolution ───────────────────────────────

  private async resolveAnthropicClient(
    tenantId: string,
  ): Promise<{ client: Anthropic; model: string }> {
    // Try tenant-specific provider first
    const providers = await this.aiProviderService.list(tenantId);
    for (const provider of providers) {
      if (!provider.isActive) continue;
      const key = await this.aiProviderService.getActiveKey(tenantId, provider.id);
      if (key) {
        return {
          client: new Anthropic({
            apiKey: key.encryptedKey,
            ...(provider.baseUrl ? { baseURL: provider.baseUrl } : {}),
          }),
          model: key.model ?? this.configService.get<string>('LLM_MODEL') ?? 'claude-sonnet-4-6',
        };
      }
    }

    // Fallback to environment variable
    return {
      client: new Anthropic({
        apiKey: this.configService.get<string>('LLM_API_KEY') ?? '',
        baseURL: this.configService.get<string>('LLM_BASE_URL'),
      }),
      model: this.configService.get<string>('LLM_MODEL') ?? 'claude-sonnet-4-6',
    };
  }

  // ── Conversation management ───────────────────────────────────

  async getOrCreateConversation(
    tenantId: string,
    projectId: string,
    userId: string,
  ): Promise<BrainConversation> {
    let conv = await this.conversationRepository.findOne({
      where: { tenantId, projectId, userId },
    });

    if (!conv) {
      conv = this.conversationRepository.create({
        tenantId,
        projectId,
        userId,
        messages: [],
      });
      conv = await this.conversationRepository.save(conv);
    }

    return conv;
  }

  async clearConversation(tenantId: string, projectId: string, userId: string): Promise<void> {
    const conv = await this.conversationRepository.findOne({
      where: { tenantId, projectId, userId },
    });
    if (conv) {
      conv.messages = [];
      await this.conversationRepository.save(conv);
    }
  }

  // ── System prompt (lean XML, no hardcoded data) ───────────────

  private async buildSystemPrompt(projectId: string, tenantId: string): Promise<string> {
    const project = await this.projectService.findOne(projectId, tenantId);
    const today = new Date().toISOString().slice(0, 10);

    return `<role>你是「${project.name}」项目的 AI 智脑助手。</role>

<project>
  <name>${project.name}</name>
  <description>${project.description ?? '（暂无）'}</description>
  <settlement_round>${project.settlementRound}</settlement_round>
  <today>${today}</today>
</project>

<instructions>
你拥有一系列工具来查询和操作项目数据。请根据用户问题主动调用工具获取真实数据，而不是凭记忆回答。

规则：
1. 查询类问题（任务列表、工分、成员等）必须先调用对应工具获取数据
2. 创建/修改操作需确认用户意图后再执行
3. 结算操作（settlement_trigger）是不可撤销的，必须明确告知用户后果
4. 用中文回答，保持专业、简洁、建设性
5. 分析数据时给出有价值的洞察和建议
</instructions>`;
  }

  // ── Agentic Loop (stream with tool calls) ─────────────────────

  async streamChat(
    tenantId: string,
    projectId: string,
    userId: string,
    userMessage: string,
    res: Response,
  ): Promise<void> {
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    try {
      const conv = await this.getOrCreateConversation(tenantId, projectId, userId);
      const systemPrompt = await this.buildSystemPrompt(projectId, tenantId);
      const { client, model } = await this.resolveAnthropicClient(tenantId);

      // Add user message to history
      const userMsg: ChatMessage = {
        role: 'user',
        content: userMessage,
        timestamp: new Date().toISOString(),
      };
      conv.messages.push(userMsg);

      // Get available tools for this user
      const resolvedTools = await this.pluginRegistry.getEnabledTools(
        tenantId,
        projectId,
        userId,
      );

      const anthropicTools: Anthropic.Tool[] = resolvedTools.map((rt) => ({
        name: rt.tool.name,
        description: rt.tool.description,
        input_schema: rt.tool.inputSchema as Anthropic.Tool.InputSchema,
      }));

      // Build API messages from conversation history (last 20 turns)
      const apiMessages = this.buildApiMessages(conv.messages.slice(-20));

      let fullResponse = '';
      const toolCallRecords: ToolCallRecord[] = [];

      // ── Agentic while(true) loop ──────────────────────────────

      while (true) {
        const stream = client.messages.stream({
          model,
          max_tokens: 4096,
          system: systemPrompt,
          messages: apiMessages,
          ...(anthropicTools.length > 0 ? { tools: anthropicTools } : {}),
        });

        let hasToolUse = false;
        const toolUseBlocks: Array<{
          id: string;
          name: string;
          input: Record<string, unknown>;
        }> = [];
        let currentText = '';

        // Collect the full response
        const response = await stream.finalMessage();

        for (const block of response.content) {
          if (block.type === 'text') {
            currentText += block.text;
            // Stream text to client
            res.write(
              `data: ${JSON.stringify({ type: 'delta', content: block.text })}\n\n`,
            );
          } else if (block.type === 'tool_use') {
            hasToolUse = true;
            toolUseBlocks.push({
              id: block.id,
              name: block.name,
              input: block.input as Record<string, unknown>,
            });
          }
        }

        fullResponse += currentText;

        // If no tool calls, we're done
        if (!hasToolUse) {
          break;
        }

        // Append assistant message to API messages
        apiMessages.push({
          role: 'assistant' as const,
          content: response.content,
        });

        // Execute tool calls and build tool_result messages
        const toolResultContent: Anthropic.ToolResultBlockParam[] = [];

        for (const toolUse of toolUseBlocks) {
          // Notify client that tool execution is starting
          res.write(
            `data: ${JSON.stringify({
              type: 'tool_call_start',
              toolUseId: toolUse.id,
              toolName: toolUse.name,
              input: toolUse.input,
            })}\n\n`,
          );

          const record: ToolCallRecord = {
            toolUseId: toolUse.id,
            toolName: toolUse.name,
            input: toolUse.input,
            status: 'pending',
          };

          try {
            const result = await this.pluginRegistry.executeTool(
              toolUse.name,
              toolUse.input,
              { tenantId, projectId, userId },
            );
            record.result = result;
            record.status = 'done';

            toolResultContent.push({
              type: 'tool_result',
              tool_use_id: toolUse.id,
              content: JSON.stringify(result),
            });
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            record.status = 'error';
            record.error = errorMsg;

            toolResultContent.push({
              type: 'tool_result',
              tool_use_id: toolUse.id,
              content: JSON.stringify({ error: errorMsg }),
              is_error: true,
            });
          }

          toolCallRecords.push(record);

          // Notify client of tool result
          res.write(
            `data: ${JSON.stringify({
              type: 'tool_call_result',
              toolUseId: toolUse.id,
              toolName: toolUse.name,
              result: record.result,
              status: record.status,
              error: record.error,
            })}\n\n`,
          );
        }

        // Append tool results to API messages
        apiMessages.push({
          role: 'user' as const,
          content: toolResultContent,
        });

        // Continue the loop — LLM will process tool results
      }

      // ── Save to conversation history ──────────────────────────

      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: fullResponse,
        timestamp: new Date().toISOString(),
        toolCalls: toolCallRecords.length > 0 ? toolCallRecords : undefined,
      };
      conv.messages.push(assistantMsg);

      // Keep history limited to 100 messages
      if (conv.messages.length > 100) {
        conv.messages = conv.messages.slice(-100);
      }

      await this.conversationRepository.save(conv);

      res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    } catch (error) {
      this.logger.error(`Brain stream error: ${String(error)}`);
      res.write(
        `data: ${JSON.stringify({ type: 'error', message: '对话出错，请重试' })}\n\n`,
      );
    } finally {
      res.end();
    }
  }

  // ── Backward-compatible task creation (used by old endpoints) ─

  async createTasksFromSuggestions(
    tenantId: string,
    projectId: string,
    createdBy: string,
    suggestions: Array<{ title: string; description?: string }>,
  ): Promise<number> {
    // Delegate to TaskService via plugin registry (keeping backward compat)
    let created = 0;
    for (const s of suggestions) {
      try {
        await this.pluginRegistry.executeTool(
          'task_create',
          { title: s.title, description: s.description },
          { tenantId, projectId, userId: createdBy },
        );
        created++;
      } catch {
        // continue
      }
    }
    return created;
  }

  // ── Helpers ───────────────────────────────────────────────────

  /**
   * Build Anthropic API messages from ChatMessage history.
   * Handles backward compatibility — old messages have no toolCalls.
   */
  private buildApiMessages(
    messages: ChatMessage[],
  ): Anthropic.MessageParam[] {
    return messages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));
  }
}
