import { Test, TestingModule } from '@nestjs/testing';
import { WebhookService } from './webhook.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { WebhookLog } from './entities/webhook-log.entity';
import { TaskService } from '../task/task.service';
import { SubmissionService } from '../submission/submission.service';
import { getQueueToken } from '@nestjs/bull';
import { QUEUE_NAMES } from '../queue/queue.constants';
import { TaskStatus } from '../task/enums/task-status.enum';

describe('WebhookService', () => {
  let service: WebhookService;
  let webhookLogRepo: { create: jest.Mock; save: jest.Mock; update: jest.Mock };
  let taskService: { findOne: jest.Mock };
  let submissionService: { create: jest.Mock };

  const mockTask = {
    id: 'task-uuid',
    tenantId: 'tenant-uuid',
    title: '测试任务',
    description: null,
    status: TaskStatus.CLAIMED,
    assigneeId: 'user-uuid',
    projectId: 'proj-uuid',
    createdBy: 'creator',
    metadata: {},
    estimatedPoints: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    webhookLogRepo = {
      create: jest.fn().mockImplementation((d) => ({ id: 'log-uuid', ...d })),
      save: jest.fn().mockImplementation((l) => Promise.resolve({ id: 'log-uuid', ...l })),
      update: jest.fn().mockResolvedValue(undefined),
    };
    taskService = { findOne: jest.fn().mockResolvedValue(mockTask) };
    submissionService = { create: jest.fn().mockResolvedValue({ id: 'sub-uuid' }) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookService,
        { provide: getRepositoryToken(WebhookLog), useValue: webhookLogRepo },
        { provide: TaskService, useValue: taskService },
        { provide: SubmissionService, useValue: submissionService },
        { provide: getQueueToken(QUEUE_NAMES.AI_REVIEW), useValue: { add: jest.fn() } },
      ],
    }).compile();

    service = module.get<WebhookService>(WebhookService);
  });

  describe('extractTaskIds', () => {
    it('应该从提交信息中提取任务ID', () => {
      expect(service.extractTaskIds('fix auth #TASK-abc12345')).toEqual(['abc12345']);
      expect(service.extractTaskIds('完成功能 #TASK-550e8400-e29b-41d4-a716-446655440000')).toHaveLength(1);
    });

    it('应该支持多个任务ID', () => {
      const ids = service.extractTaskIds('fix #TASK-abc12345 and #TASK-def67890');
      expect(ids).toHaveLength(2);
    });

    it('应该去重', () => {
      const ids = service.extractTaskIds('#TASK-abc12345 #TASK-abc12345');
      expect(ids).toHaveLength(1);
    });

    it('没有任务ID时返回空数组', () => {
      expect(service.extractTaskIds('regular commit message')).toHaveLength(0);
    });

    it('大小写不敏感', () => {
      const ids = service.extractTaskIds('#task-abc12345');
      expect(ids).toHaveLength(1);
    });
  });

  describe('processCommit', () => {
    const commitData = {
      tenantId: 'tenant-uuid',
      taskId: 'task-uuid',
      commitHash: 'abc123def456',
      commitMessage: 'fix auth #TASK-task-uuid',
      repoUrl: 'https://github.com/org/repo',
      commitUrl: 'https://github.com/org/repo/commit/abc123',
    };

    it('应该处理 commit 并创建提交记录', async () => {
      await service.processCommit(commitData);
      expect(submissionService.create).toHaveBeenCalled();
      expect(webhookLogRepo.update).toHaveBeenCalledWith(expect.any(String), { status: 'completed' });
    });

    it('任务不在 CLAIMED 状态时应该跳过', async () => {
      taskService.findOne.mockResolvedValue({ ...mockTask, status: TaskStatus.OPEN });
      await service.processCommit(commitData);
      expect(submissionService.create).not.toHaveBeenCalled();
      expect(webhookLogRepo.update).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ status: 'skipped' }));
    });
  });
});
