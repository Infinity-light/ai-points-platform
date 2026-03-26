import { Test, TestingModule } from '@nestjs/testing';
import { SubmissionService } from './submission.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Submission, SubmissionType } from './entities/submission.entity';
import { TaskService } from '../task/task.service';
import { getQueueToken } from '@nestjs/bull';
import { QUEUE_NAMES } from '../queue/queue.constants';
import { BadRequestException } from '@nestjs/common';
import { TaskStatus } from '../task/enums/task-status.enum';

const mockTask = {
  id: 'task-uuid',
  tenantId: 'tenant-uuid',
  title: '测试任务',
  description: '描述',
  status: TaskStatus.CLAIMED,
  assigneeId: 'user-uuid',
  projectId: 'proj-uuid',
  createdBy: 'creator-uuid',
  metadata: {},
  estimatedPoints: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockSubmission: Submission = {
  id: 'sub-uuid',
  tenantId: 'tenant-uuid',
  taskId: 'task-uuid',
  submittedBy: 'user-uuid',
  type: SubmissionType.MANUAL,
  content: '完成了工作',
  metadata: {},
  aiReviewStatus: 'pending',
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('SubmissionService', () => {
  let service: SubmissionService;
  let submissionRepo: {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
    find: jest.Mock;
    update: jest.Mock;
  };
  let taskService: jest.Mocked<Partial<TaskService>>;
  let aiReviewQueue: { add: jest.Mock };

  beforeEach(async () => {
    submissionRepo = {
      create: jest.fn().mockImplementation((data) => ({ ...mockSubmission, ...data })),
      save: jest.fn().mockImplementation((s) => Promise.resolve({ ...mockSubmission, ...s })),
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([mockSubmission]),
      update: jest.fn().mockResolvedValue(undefined),
    };

    taskService = {
      findOne: jest.fn().mockResolvedValue(mockTask),
      transition: jest.fn().mockImplementation((id, tenantId, userId, status) =>
        Promise.resolve({ ...mockTask, status })
      ),
    };

    aiReviewQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job-uuid' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubmissionService,
        { provide: getRepositoryToken(Submission), useValue: submissionRepo },
        { provide: TaskService, useValue: taskService },
        { provide: getQueueToken(QUEUE_NAMES.AI_REVIEW), useValue: aiReviewQueue },
      ],
    }).compile();

    service = module.get<SubmissionService>(SubmissionService);
  });

  describe('create', () => {
    it('应该创建提交记录并触发 AI 评审队列', async () => {
      const result = await service.create('tenant-uuid', 'user-uuid', {
        taskId: 'task-uuid',
        type: SubmissionType.MANUAL,
        content: '完成工作说明',
      });

      expect(result).toBeDefined();
      expect(aiReviewQueue.add).toHaveBeenCalled();
      expect(taskService.transition).toHaveBeenCalledTimes(2); // SUBMITTED + AI_REVIEWING
    });

    it('非 assignee 提交应该抛出 BadRequestException', async () => {
      await expect(
        service.create('tenant-uuid', 'other-user', {
          taskId: 'task-uuid',
          type: SubmissionType.MANUAL,
          content: '提交',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('任务状态不是 CLAIMED 时应该抛出 BadRequestException', async () => {
      taskService.findOne!.mockResolvedValue({ ...mockTask, status: TaskStatus.OPEN, assigneeId: 'user-uuid' } as any);
      await expect(
        service.create('tenant-uuid', 'user-uuid', {
          taskId: 'task-uuid',
          type: SubmissionType.MANUAL,
          content: '提交',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
