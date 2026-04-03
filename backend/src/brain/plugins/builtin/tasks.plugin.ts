import { Injectable } from '@nestjs/common';
import {
  BrainPlugin,
  BrainTool,
  BrainToolContext,
} from '../../interfaces/brain-plugin.interface';
import { TaskService } from '../../../task/task.service';
import { TaskStatus } from '../../../task/enums/task-status.enum';

@Injectable()
export class TasksPlugin implements BrainPlugin {
  id = 'builtin:tasks';
  name = '任务管理';
  type = 'builtin' as const;

  constructor(private readonly taskService: TaskService) {}

  get tools(): BrainTool[] {
    return [
      {
        name: 'task_list',
        description: '列出当前项目的所有任务，返回标题、状态、负责人、优先级等信息',
        inputSchema: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              description: '按状态筛选 (open/claimed/submitted/pending_review/settled/cancelled)',
            },
          },
        },
        call: async (input: Record<string, unknown>, ctx: BrainToolContext) => {
          const tasks = await this.taskService.findAll(ctx.tenantId, ctx.projectId);
          const status = input.status as string | undefined;
          const filtered = status
            ? tasks.filter((t) => t.status === status)
            : tasks;
          return filtered.map((t) => ({
            id: t.id,
            title: t.title,
            status: t.status,
            assigneeId: t.assigneeId,
            priority: t.metadata?.priority,
            tags: t.metadata?.tags,
            finalPoints: t.metadata?.finalPoints,
            createdAt: t.createdAt,
          }));
        },
      },
      {
        name: 'task_get',
        description: '获取单个任务的详细信息，包括描述、元数据、AI评分等',
        inputSchema: {
          type: 'object',
          properties: {
            taskId: { type: 'string', description: '任务 ID' },
          },
          required: ['taskId'],
        },
        call: async (input: Record<string, unknown>, ctx: BrainToolContext) => {
          const task = await this.taskService.findOne(
            input.taskId as string,
            ctx.tenantId,
          );
          return {
            id: task.id,
            title: task.title,
            description: task.description,
            status: task.status,
            assigneeId: task.assigneeId,
            metadata: task.metadata,
            createdAt: task.createdAt,
            updatedAt: task.updatedAt,
          };
        },
      },
      {
        name: 'task_create',
        description: '创建一个新任务。需要提供标题，描述可选。',
        inputSchema: {
          type: 'object',
          properties: {
            title: { type: 'string', description: '任务标题' },
            description: { type: 'string', description: '任务描述（可选）' },
          },
          required: ['title'],
        },
        requiredPermission: { resource: 'tasks', action: 'create' },
        call: async (input: Record<string, unknown>, ctx: BrainToolContext) => {
          const task = await this.taskService.create(
            ctx.tenantId,
            ctx.projectId,
            ctx.userId,
            {
              title: input.title as string,
              description: input.description as string | undefined,
            },
          );
          return { id: task.id, title: task.title, status: task.status };
        },
      },
      {
        name: 'task_update',
        description: '更新任务的标题、描述或元数据',
        inputSchema: {
          type: 'object',
          properties: {
            taskId: { type: 'string', description: '任务 ID' },
            title: { type: 'string', description: '新标题' },
            description: { type: 'string', description: '新描述' },
          },
          required: ['taskId'],
        },
        requiredPermission: { resource: 'tasks', action: 'update' },
        call: async (input: Record<string, unknown>, ctx: BrainToolContext) => {
          const { taskId, ...dto } = input;
          const task = await this.taskService.update(
            taskId as string,
            ctx.tenantId,
            dto as { title?: string; description?: string },
          );
          return { id: task.id, title: task.title, status: task.status };
        },
      },
      {
        name: 'task_transition',
        description:
          '变更任务状态。可用状态: open, claimed, submitted, cancelled。注意：某些状态转换有限制（如只有负责人可以提交）',
        inputSchema: {
          type: 'object',
          properties: {
            taskId: { type: 'string', description: '任务 ID' },
            toStatus: {
              type: 'string',
              description: '目标状态 (open/claimed/submitted/cancelled)',
            },
          },
          required: ['taskId', 'toStatus'],
        },
        requiredPermission: { resource: 'tasks', action: 'update' },
        call: async (input: Record<string, unknown>, ctx: BrainToolContext) => {
          const task = await this.taskService.transition(
            input.taskId as string,
            ctx.tenantId,
            ctx.userId,
            input.toStatus as TaskStatus,
          );
          return { id: task.id, title: task.title, status: task.status };
        },
      },
    ];
  }

  async initialize(): Promise<void> {
    /* builtin — no setup needed */
  }

  async destroy(): Promise<void> {
    /* builtin — no cleanup needed */
  }
}
