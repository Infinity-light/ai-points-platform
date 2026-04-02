import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Task } from './entities/task.entity';
import { TaskStatus } from './enums/task-status.enum';
import { validateTransition, getAllowedTransitions } from './task-state-machine';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

export type ClaimTaskResult =
  | { kind: 'claimed'; task: Task }
  | { kind: 'auction_created'; auctionId: string; taskId: string };

@Injectable()
export class TaskService {
  // Injected lazily to avoid circular dependency with AuctionModule
  auctionServiceRef?: {
    create: (opts: {
      tenantId: string;
      createdBy: string;
      dto: {
        type: 'task_claim';
        targetEntity: string;
        targetId: string;
        description: string;
        endsAt: Date;
      };
    }) => Promise<{ id: string }>;
    placeBid: (opts: {
      auctionId: string;
      userId: string;
      tenantId: string;
      amount: number;
    }) => Promise<unknown>;
  };

  constructor(
    @InjectRepository(Task)
    private readonly taskRepository: Repository<Task>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(
    tenantId: string,
    projectId: string,
    createdBy: string,
    dto: CreateTaskDto,
  ): Promise<Task> {
    const task = this.taskRepository.create({
      tenantId,
      projectId,
      createdBy,
      title: dto.title,
      description: dto.description ?? null,
      estimatedPoints: null,
      status: TaskStatus.OPEN,
      metadata: dto.metadata ?? {},
    });
    const saved = await this.taskRepository.save(task);
    this.eventEmitter.emit('task.created', { task: saved, tenantId });
    return saved;
  }

  async findAll(tenantId: string, projectId: string): Promise<Task[]> {
    return this.taskRepository.find({
      where: { tenantId, projectId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, tenantId: string): Promise<Task> {
    const task = await this.taskRepository.findOne({ where: { id, tenantId } });
    if (!task) throw new NotFoundException(`任务 ${id} 不存在`);
    return task;
  }

  async update(id: string, tenantId: string, dto: UpdateTaskDto): Promise<Task> {
    const task = await this.findOne(id, tenantId);
    if (dto.title !== undefined) task.title = dto.title;
    if (dto.description !== undefined) task.description = dto.description ?? null;
    // estimatedPoints no longer set from DTO — determined by review meeting
    if (dto.metadata !== undefined) {
      task.metadata = { ...task.metadata, ...dto.metadata };
    }
    const saved = await this.taskRepository.save(task);
    this.eventEmitter.emit('task.updated', { task: saved, tenantId });
    return saved;
  }

  /**
   * 状态转换（核心业务逻辑）
   */
  async transition(
    id: string,
    tenantId: string,
    userId: string,
    toStatus: TaskStatus,
  ): Promise<Task> {
    const task = await this.findOne(id, tenantId);

    // 验证转换合法性
    validateTransition(task.status, toStatus);

    // 业务规则校验
    if (toStatus === TaskStatus.CLAIMED) {
      // 认领时设置 assignee
      task.assigneeId = userId;
    } else if (toStatus === TaskStatus.OPEN && task.status === TaskStatus.CLAIMED) {
      // 放弃认领：只有当前 assignee 可以放弃
      if (task.assigneeId !== userId) {
        throw new ForbiddenException('只有当前认领者可以放弃认领');
      }
      task.assigneeId = null;
    } else if (toStatus === TaskStatus.SUBMITTED) {
      // 提交时只有 assignee 可以
      if (task.assigneeId !== userId) {
        throw new ForbiddenException('只有任务认领者可以提交');
      }
    }

    task.status = toStatus;
    return this.taskRepository.save(task);
  }

  async updateAiScores(
    id: string,
    tenantId: string,
    aiScores: NonNullable<Task['metadata']['aiScores']>,
  ): Promise<Task> {
    const task = await this.findOne(id, tenantId);
    task.metadata = { ...task.metadata, aiScores };
    task.status = TaskStatus.PENDING_REVIEW;
    return this.taskRepository.save(task);
  }

  async settle(id: string, tenantId: string, finalPoints: number): Promise<Task> {
    const task = await this.findOne(id, tenantId);
    validateTransition(task.status, TaskStatus.SETTLED);
    task.metadata = { ...task.metadata, finalPoints };
    task.status = TaskStatus.SETTLED;
    return this.taskRepository.save(task);
  }

  async getMyTasks(tenantId: string, userId: string): Promise<Task[]> {
    return this.taskRepository.find({
      where: { tenantId, assigneeId: userId },
      order: { updatedAt: 'DESC' },
    });
  }

  /**
   * 认领任务，支持竞拍模式：
   * - claimMode='multi'：允许多人认领，直接设置 assigneeId（或追加）
   * - claimMode='single' 且已有认领者：创建竞拍，第一认领者自动出价 0
   * - claimMode='single' 且尚未认领：直接认领
   */
  async claimTask(opts: {
    taskId: string;
    tenantId: string;
    userId: string;
  }): Promise<ClaimTaskResult> {
    const { taskId, tenantId, userId } = opts;
    const task = await this.findOne(taskId, tenantId);

    if (task.claimMode === 'multi') {
      // 多人认领：设置 assigneeId 为请求者（last-writer 语义，业务上允许多人同时跑）
      task.assigneeId = userId;
      task.status = TaskStatus.CLAIMED;
      const saved = await this.taskRepository.save(task);
      return { kind: 'claimed', task: saved };
    }

    // single 模式
    if (!task.assigneeId) {
      // 无人认领，直接认领
      task.assigneeId = userId;
      task.status = TaskStatus.CLAIMED;
      const saved = await this.taskRepository.save(task);
      return { kind: 'claimed', task: saved };
    }

    // 已有人认领：触发竞拍
    if (!this.auctionServiceRef) {
      throw new ForbiddenException('任务已被认领，竞拍服务不可用');
    }

    const endsAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    const auction = await this.auctionServiceRef.create({
      tenantId,
      createdBy: userId,
      dto: {
        type: 'task_claim',
        targetEntity: 'task',
        targetId: taskId,
        description: `任务认领竞拍：${task.title}`,
        endsAt,
      },
    });

    // 当前认领者自动出价 0
    await this.auctionServiceRef.placeBid({
      auctionId: auction.id,
      userId: task.assigneeId,
      tenantId,
      amount: 0,
    });

    return { kind: 'auction_created', auctionId: auction.id, taskId };
  }
}
