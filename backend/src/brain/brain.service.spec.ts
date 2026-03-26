import { Test, TestingModule } from '@nestjs/testing';
import { BrainService } from './brain.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BrainConversation } from './entities/brain-conversation.entity';
import { TaskService } from '../task/task.service';
import { ProjectService } from '../project/project.service';
import { ConfigService } from '@nestjs/config';

const mockCreate = jest.fn().mockResolvedValue({
  content: [{ type: 'text', text: '[{"title":"测试任务","description":"描述","estimatedPoints":10}]' }],
});

const mockStream = jest.fn().mockReturnValue({
  [Symbol.asyncIterator]: async function* () {
    yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hello' } };
    yield { type: 'content_block_delta', delta: { type: 'text_delta', text: ' World' } };
  },
});

// Mock Anthropic — must include __esModule: true for ts-jest CJS interop
jest.mock('@anthropic-ai/sdk', () => {
  const MockAnthropic = jest.fn().mockImplementation(() => ({
    messages: {
      create: mockCreate,
      stream: mockStream,
    },
  }));
  return { __esModule: true, default: MockAnthropic };
});

const mockProject = {
  id: 'proj-uuid',
  tenantId: 'tenant-uuid',
  name: '测试项目',
  description: null,
  status: 'active',
  settlementRound: 0,
  annealingConfig: { cyclesPerStep: 3, maxSteps: 9 },
  settlementConfig: { periodType: 'weekly' },
  createdBy: 'user-uuid',
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('BrainService', () => {
  let service: BrainService;
  let convRepo: { findOne: jest.Mock; create: jest.Mock; save: jest.Mock };
  let taskService: { findAll: jest.Mock; create: jest.Mock; findOne: jest.Mock };
  let projectService: { findOne: jest.Mock };

  beforeEach(async () => {
    convRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((d) => ({ id: 'conv-uuid', messages: [], ...d })),
      save: jest.fn().mockImplementation((c) => Promise.resolve(c)),
    };

    taskService = {
      findAll: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({ id: 'task-uuid', title: 'New Task' }),
      findOne: jest.fn(),
    };

    projectService = {
      findOne: jest.fn().mockResolvedValue(mockProject),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BrainService,
        { provide: getRepositoryToken(BrainConversation), useValue: convRepo },
        { provide: TaskService, useValue: taskService },
        { provide: ProjectService, useValue: projectService },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('test-value') },
        },
      ],
    }).compile();

    service = module.get<BrainService>(BrainService);
  });

  describe('getOrCreateConversation', () => {
    it('不存在时应该创建新对话', async () => {
      const result = await service.getOrCreateConversation('tenant-uuid', 'proj-uuid', 'user-uuid');
      expect(convRepo.create).toHaveBeenCalled();
      expect(convRepo.save).toHaveBeenCalled();
      expect(result.messages).toEqual([]);
    });

    it('已存在时应该返回现有对话', async () => {
      convRepo.findOne.mockResolvedValue({ id: 'conv-uuid', messages: [{ role: 'user', content: 'hi' }] });
      const result = await service.getOrCreateConversation('tenant-uuid', 'proj-uuid', 'user-uuid');
      expect(convRepo.create).not.toHaveBeenCalled();
      expect(result.messages).toHaveLength(1);
    });
  });

  describe('suggestTasks', () => {
    it('应该返回 AI 建议的任务列表', async () => {
      const result = await service.suggestTasks('tenant-uuid', 'proj-uuid', 'user-uuid', '给我推荐一些任务');
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('测试任务');
      expect(result[0].estimatedPoints).toBe(10);
    });
  });

  describe('createTasksFromSuggestions', () => {
    it('应该批量创建任务', async () => {
      const count = await service.createTasksFromSuggestions(
        'tenant-uuid', 'proj-uuid', 'user-uuid',
        [{ title: '任务1', description: '描述', estimatedPoints: 5 }, { title: '任务2' }]
      );
      expect(count).toBe(2);
      expect(taskService.create).toHaveBeenCalledTimes(2);
    });
  });

  describe('clearConversation', () => {
    it('应该清空消息历史', async () => {
      convRepo.findOne.mockResolvedValue({ id: 'conv-uuid', messages: [{ role: 'user', content: 'hi' }] });
      await service.clearConversation('tenant-uuid', 'proj-uuid', 'user-uuid');
      expect(convRepo.save).toHaveBeenCalledWith(expect.objectContaining({ messages: [] }));
    });
  });
});
