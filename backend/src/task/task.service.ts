import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task } from './entities/task.entity';
import { TaskStatus } from './enums/task-status.enum';
import { validateTransition, getAllowedTransitions } from './task-state-machine';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

@Injectable()
export class TaskService {
  constructor(
    @InjectRepository(Task)
    private readonly taskRepository: Repository<Task>,
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
      estimatedPoints: dto.estimatedPoints ?? null,
      status: TaskStatus.OPEN,
      metadata: dto.metadata ?? {},
    });
    return this.taskRepository.save(task);
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
    if (dto.estimatedPoints !== undefined) task.estimatedPoints = dto.estimatedPoints ?? null;
    if (dto.metadata !== undefined) {
      task.metadata = { ...task.metadata, ...dto.metadata };
    }
    return this.taskRepository.save(task);
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
    task.status = TaskStatus.PENDING_VOTE;
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
}
