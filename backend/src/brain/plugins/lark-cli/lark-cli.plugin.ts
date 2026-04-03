import { Injectable, Logger } from '@nestjs/common';
import { execFile } from 'child_process';
import { promisify } from 'util';
import {
  BrainPlugin,
  BrainTool,
  BrainToolContext,
} from '../../interfaces/brain-plugin.interface';

const execFileAsync = promisify(execFile);

@Injectable()
export class LarkCliPlugin implements BrainPlugin {
  private readonly logger = new Logger(LarkCliPlugin.name);

  id = 'cli:lark';
  name = '飞书 CLI';
  type = 'cli' as const;

  private appId = '';
  private appSecret = '';

  get tools(): BrainTool[] {
    return [
      {
        name: 'lark_bitable_query',
        description: '查询飞书多维表格数据。需要提供 app_token 和 table_id。',
        inputSchema: {
          type: 'object',
          properties: {
            app_token: { type: 'string', description: '多维表格 app_token' },
            table_id: { type: 'string', description: '数据表 table_id' },
            filter: { type: 'string', description: '筛选条件（可选）' },
            page_size: { type: 'number', description: '每页数量，默认 20' },
          },
          required: ['app_token', 'table_id'],
        },
        requiredPermission: { resource: 'feishu', action: 'read' },
        call: async (input: Record<string, unknown>) => {
          const args = [
            'bitable', 'record', 'list',
            '--app-token', input.app_token as string,
            '--table-id', input.table_id as string,
            '--page-size', String(input.page_size ?? 20),
            '--output', 'json',
          ];
          if (input.filter) args.push('--filter', input.filter as string);
          return this.exec(args);
        },
      },
      {
        name: 'lark_bitable_create',
        description: '在飞书多维表格中创建新记录',
        inputSchema: {
          type: 'object',
          properties: {
            app_token: { type: 'string', description: '多维表格 app_token' },
            table_id: { type: 'string', description: '数据表 table_id' },
            fields: { type: 'object', description: '字段键值对' },
          },
          required: ['app_token', 'table_id', 'fields'],
        },
        requiredPermission: { resource: 'feishu', action: 'manage' },
        call: async (input: Record<string, unknown>) => {
          const args = [
            'bitable', 'record', 'create',
            '--app-token', input.app_token as string,
            '--table-id', input.table_id as string,
            '--fields', JSON.stringify(input.fields),
            '--output', 'json',
          ];
          return this.exec(args);
        },
      },
      {
        name: 'lark_send_message',
        description: '通过飞书发送消息。支持发送到用户或群聊。',
        inputSchema: {
          type: 'object',
          properties: {
            receive_id: { type: 'string', description: '接收者 ID（user_id 或 chat_id）' },
            receive_id_type: { type: 'string', description: 'ID 类型: open_id/user_id/union_id/email/chat_id' },
            msg_type: { type: 'string', description: '消息类型: text/post/interactive' },
            content: { type: 'string', description: '消息内容 JSON' },
          },
          required: ['receive_id', 'receive_id_type', 'msg_type', 'content'],
        },
        requiredPermission: { resource: 'feishu', action: 'manage' },
        call: async (input: Record<string, unknown>) => {
          const args = [
            'message', 'send',
            '--receive-id', input.receive_id as string,
            '--receive-id-type', input.receive_id_type as string,
            '--msg-type', input.msg_type as string,
            '--content', input.content as string,
            '--output', 'json',
          ];
          return this.exec(args);
        },
      },
      {
        name: 'lark_create_task',
        description: '在飞书任务中创建新任务',
        inputSchema: {
          type: 'object',
          properties: {
            summary: { type: 'string', description: '任务标题' },
            description: { type: 'string', description: '任务描述' },
            due: { type: 'string', description: '截止日期 (YYYY-MM-DD)' },
          },
          required: ['summary'],
        },
        requiredPermission: { resource: 'feishu', action: 'manage' },
        call: async (input: Record<string, unknown>) => {
          const args = [
            'task', 'create',
            '--summary', input.summary as string,
            '--output', 'json',
          ];
          if (input.description) args.push('--description', input.description as string);
          if (input.due) args.push('--due', input.due as string);
          return this.exec(args);
        },
      },
      {
        name: 'lark_search_contact',
        description: '搜索飞书通讯录中的用户',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: '搜索关键词（姓名/邮箱）' },
          },
          required: ['query'],
        },
        requiredPermission: { resource: 'feishu', action: 'read' },
        call: async (input: Record<string, unknown>) => {
          const args = [
            'contact', 'user', 'search',
            '--query', input.query as string,
            '--output', 'json',
          ];
          return this.exec(args);
        },
      },
    ];
  }

  async initialize(config: Record<string, unknown>): Promise<void> {
    this.appId = (config.appId as string) ?? '';
    this.appSecret = (config.appSecret as string) ?? '';
    this.logger.log('LarkCliPlugin initialized');
  }

  async destroy(): Promise<void> {
    this.logger.log('LarkCliPlugin destroyed');
  }

  private async exec(args: string[]): Promise<unknown> {
    const env: Record<string, string> = { ...process.env } as Record<string, string>;
    if (this.appId) env.LARK_APP_ID = this.appId;
    if (this.appSecret) env.LARK_APP_SECRET = this.appSecret;

    try {
      const { stdout } = await execFileAsync('lark-cli', args, {
        timeout: 15000,
        env,
      });
      try {
        return JSON.parse(stdout);
      } catch {
        return { output: stdout.trim() };
      }
    } catch (error: unknown) {
      const err = error as { stderr?: string; message?: string };
      throw new Error(`lark-cli 执行失败: ${err.stderr || err.message}`);
    }
  }
}
