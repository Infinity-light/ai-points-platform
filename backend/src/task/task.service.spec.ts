import { Test, TestingModule } from '@nestjs/testing';
import { TaskService } from './task.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Task } from './entities/task.entity';
import { TaskStatus } from './enums/task-status.enum';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';

const mockTask: Task = {
  id: 'task-uuid',
  tenantId: 'tenant-uuid',
  projectId: 'proj-uuid',
  title: '测试任务',
  description: null,
  status: TaskStatus.OPEN,
  assigneeId: null,
  createdBy: 'creator-uuid',
  metadata: {},
  estimatedPoints: null,
  claimMode: 'single',
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('TaskService', () => {
  let service: TaskService;
  let taskRepo: {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
    find: jest.Mock;
  };

  beforeEach(async () => {
    taskRepo = {
      create: jest.fn().mockImplementation((data) => ({ ...mockTask, ...data })),
      save: jest.fn().mockImplementation((t) => Promise.resolve({ ...mockTask, ...t })),
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([mockTask]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskService,
        { provide: getRepositoryToken(Task), useValue: taskRepo },
      ],
    }).compile();

    service = module.get<TaskService>(TaskService);
  });

  describe('create', () => {
    it('应该创建状态为 OPEN 的任务', async () => {
      const result = await service.create('tenant-uuid', 'proj-uuid', 'creator-uuid', { title: '新任务' });
      expect(result.status).toBe(TaskStatus.OPEN);
      expect(result.title).toBe('新任务');
    });
  });

  describe('findOne', () => {
    it('应该返回存在的任务', async () => {
      taskRepo.findOne.mockResolvedValue(mockTask);
      const result = await service.findOne('task-uuid', 'tenant-uuid');
      expect(result.id).toBe('task-uuid');
    });

    it('不存在的任务应该抛出 NotFoundException', async () => {
      taskRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne('bad', 'tenant-uuid')).rejects.toThrow(NotFoundException);
    });
  });

  describe('transition', () => {
    it('OPEN → CLAIMED：设置 assigneeId', async () => {
      taskRepo.findOne.mockResolvedValue({ ...mockTask, status: TaskStatus.OPEN });
      taskRepo.save.mockImplementation((t) => Promise.resolve(t));
      const result = await service.transition('task-uuid', 'tenant-uuid', 'user-uuid', TaskStatus.CLAIMED);
      expect(result.status).toBe(TaskStatus.CLAIMED);
      expect(result.assigneeId).toBe('user-uuid');
    });

    it('CLAIMED → OPEN：assignee 放弃认领', async () => {
      taskRepo.findOne.mockResolvedValue({ ...mockTask, status: TaskStatus.CLAIMED, assigneeId: 'user-uuid' });
      taskRepo.save.mockImplementation((t) => Promise.resolve(t));
      const result = await service.transition('task-uuid', 'tenant-uuid', 'user-uuid', TaskStatus.OPEN);
      expect(result.assigneeId).toBeNull();
    });

    it('非 assignee 放弃认领应该抛出 ForbiddenException', async () => {
      taskRepo.findOne.mockResolvedValue({ ...mockTask, status: TaskStatus.CLAIMED, assigneeId: 'user-uuid' });
      await expect(service.transition('task-uuid', 'tenant-uuid', 'other-user', TaskStatus.OPEN))
        .rejects.toThrow(ForbiddenException);
    });

    it('非 assignee 提交应该抛出 ForbiddenException', async () => {
      taskRepo.findOne.mockResolvedValue({ ...mockTask, status: TaskStatus.CLAIMED, assigneeId: 'user-uuid' });
      await expect(service.transition('task-uuid', 'tenant-uuid', 'other-user', TaskStatus.SUBMITTED))
        .rejects.toThrow(ForbiddenException);
    });

    it('非法状态转换应该抛出 BadRequestException', async () => {
      taskRepo.findOne.mockResolvedValue({ ...mockTask, status: TaskStatus.OPEN });
      await expect(service.transition('task-uuid', 'tenant-uuid', 'user-uuid', TaskStatus.SETTLED))
        .rejects.toThrow(BadRequestException);
    });
  });

  describe('updateAiScores', () => {
    it('应该更新 AI 分数并转换状态为 PENDING_REVIEW', async () => {
      taskRepo.findOne.mockResolvedValue({ ...mockTask, status: TaskStatus.SUBMITTED });
      taskRepo.save.mockImplementation((t) => Promise.resolve(t));
      const scores = { research: 4, planning: 3, execution: 5, average: 4, rawScores: [] };
      const result = await service.updateAiScores('task-uuid', 'tenant-uuid', scores);
      expect(result.metadata.aiScores).toEqual(scores);
      expect(result.status).toBe(TaskStatus.PENDING_REVIEW);
    });
  });

  describe('settle', () => {
    it('应该固化工分并转换状态为 SETTLED', async () => {
      taskRepo.findOne.mockResolvedValue({ ...mockTask, status: TaskStatus.PENDING_REVIEW });
      taskRepo.save.mockImplementation((t) => Promise.resolve(t));
      const result = await service.settle('task-uuid', 'tenant-uuid', 50);
      expect(result.status).toBe(TaskStatus.SETTLED);
      expect(result.metadata.finalPoints).toBe(50);
    });
  });
});
