import { Test, TestingModule } from '@nestjs/testing';
import { BrainService } from './brain.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BrainConversation } from './entities/brain-conversation.entity';
import { ProjectService } from '../project/project.service';
import { ConfigService } from '@nestjs/config';
import { AiProviderService } from '../ai-config/ai-provider.service';
import { PluginRegistry } from './plugin-registry.service';

// Mock Anthropic — must include __esModule: true for ts-jest CJS interop
jest.mock('@anthropic-ai/sdk', () => {
  const MockAnthropic = jest.fn().mockImplementation(() => ({
    messages: {
      stream: jest.fn().mockReturnValue({
        finalMessage: jest.fn().mockResolvedValue({
          content: [{ type: 'text', text: 'Hello World' }],
          stop_reason: 'end_turn',
        }),
      }),
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
  let projectService: { findOne: jest.Mock };
  let pluginRegistry: { getEnabledTools: jest.Mock; executeTool: jest.Mock };

  beforeEach(async () => {
    convRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((d) => ({ id: 'conv-uuid', messages: [], ...d })),
      save: jest.fn().mockImplementation((c) => Promise.resolve(c)),
    };

    projectService = {
      findOne: jest.fn().mockResolvedValue(mockProject),
    };

    pluginRegistry = {
      getEnabledTools: jest.fn().mockResolvedValue([]),
      executeTool: jest.fn().mockResolvedValue({ id: 'task-uuid', title: 'New Task' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BrainService,
        { provide: getRepositoryToken(BrainConversation), useValue: convRepo },
        { provide: ProjectService, useValue: projectService },
        { provide: AiProviderService, useValue: { list: jest.fn().mockResolvedValue([]) } },
        { provide: PluginRegistry, useValue: pluginRegistry },
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

  describe('createTasksFromSuggestions', () => {
    it('应该批量创建任务', async () => {
      const count = await service.createTasksFromSuggestions(
        'tenant-uuid', 'proj-uuid', 'user-uuid',
        [{ title: '任务1', description: '描述' }, { title: '任务2' }],
      );
      expect(count).toBe(2);
      expect(pluginRegistry.executeTool).toHaveBeenCalledTimes(2);
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
