import { Test, TestingModule } from '@nestjs/testing';
import { AiService, ReviewInput } from './ai.service';
import { ConfigService } from '@nestjs/config';
import { AiProviderService } from '../ai-config/ai-provider.service';

const mockCreate = jest.fn().mockResolvedValue({
  content: [{ type: 'text', text: '{"research":4,"planning":3,"execution":5}' }],
});

// Mock Anthropic — must include __esModule: true for ts-jest CJS interop
jest.mock('@anthropic-ai/sdk', () => {
  const MockAnthropic = jest.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  }));
  return { __esModule: true, default: MockAnthropic };
});

describe('AiService', () => {
  let service: AiService;

  beforeEach(async () => {
    mockCreate.mockClear();
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: '{"research":4,"planning":3,"execution":5}' }],
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('test-value'),
          },
        },
        {
          provide: AiProviderService,
          useValue: {
            list: jest.fn().mockResolvedValue([]),
            getActiveKey: jest.fn().mockResolvedValue(null),
          },
        },
      ],
    }).compile();

    service = module.get<AiService>(AiService);
  });

  it('应该调用 LLM 3 次并返回平均分', async () => {
    const input: ReviewInput = {
      taskTitle: '测试任务',
      taskDescription: '任务描述',
      submissionContent: '提交内容',
      submissionType: 'manual',
    };

    const result = await service.reviewSubmission(input);

    // Mock returns {4,3,5} each call; 3 calls → research=4, planning=3, execution=5, avg=4
    expect(mockCreate).toHaveBeenCalledTimes(3);
    expect(result.research).toBe(4);
    expect(result.planning).toBe(3);
    expect(result.execution).toBe(5);
    expect(result.average).toBe(4);
    expect(result.rawScores).toHaveLength(3);
  });

  it('应该将分数限制在 0-5 范围内', async () => {
    const result = await service.reviewSubmission({
      taskTitle: 'test',
      taskDescription: null,
      submissionContent: 'content',
      submissionType: 'explore',
    });
    expect(result.research).toBeGreaterThanOrEqual(0);
    expect(result.research).toBeLessThanOrEqual(5);
    expect(result.planning).toBeGreaterThanOrEqual(0);
    expect(result.planning).toBeLessThanOrEqual(5);
    expect(result.execution).toBeGreaterThanOrEqual(0);
    expect(result.execution).toBeLessThanOrEqual(5);
  });

  it('部分调用失败时应跳过失败结果并用成功结果取均值', async () => {
    mockCreate
      .mockRejectedValueOnce(new Error('API Error'))
      .mockResolvedValueOnce({ content: [{ type: 'text', text: '{"research":4,"planning":4,"execution":4}' }] })
      .mockResolvedValueOnce({ content: [{ type: 'text', text: '{"research":2,"planning":2,"execution":2}' }] });

    const result = await service.reviewSubmission({
      taskTitle: 'test',
      taskDescription: null,
      submissionContent: 'content',
      submissionType: 'ai-exec',
    });

    // Only 2 successful calls: {4,4,4} and {2,2,2} → average = 3
    expect(result.rawScores).toHaveLength(2);
    expect(result.research).toBe(3);
    expect(result.planning).toBe(3);
    expect(result.execution).toBe(3);
  });

  it('三次调用均失败时应抛出错误（让队列重试）', async () => {
    mockCreate
      .mockRejectedValueOnce(new Error('API Error'))
      .mockRejectedValueOnce(new Error('API Error'))
      .mockRejectedValueOnce(new Error('API Error'));

    await expect(
      service.reviewSubmission({
        taskTitle: 'test',
        taskDescription: null,
        submissionContent: 'content',
        submissionType: 'ai-exec',
      }),
    ).rejects.toThrow('AI 评审失败：3 次调用均未成功');
  });
});
