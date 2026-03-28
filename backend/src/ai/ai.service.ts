import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';

export interface TaskScoreResult {
  research: number;
  planning: number;
  execution: number;
  average: number;
  rawScores: Array<{ research: number; planning: number; execution: number }>;
}

export interface ReviewInput {
  taskTitle: string;
  taskDescription: string | null;
  submissionContent: string;
  submissionType: 'explore' | 'ai-exec' | 'manual';
}

const SCORING_PROMPT = `你是一个公平、客观的工作成果评审员。你将对一个任务提交进行三维度评分。

评分维度（每维度0-5分，整数）：
- 调查（research）：前期信息收集、问题分析的深度和广度
- 规划（planning）：方案设计、执行计划的完整性和合理性
- 执行（execution）：实际产出物的质量、完成度和专业水平

评分标准：
0 = 完全不达标或缺失
1 = 严重不足
2 = 基本合格
3 = 良好
4 = 优秀
5 = 卓越

重要规则：
- 不要考虑提交者是谁（已隐去姓名）
- 基于客观事实评分，不要猜测
- 必须返回严格的 JSON 格式，不要有任何其他文字

返回格式（仅返回 JSON，不要有任何 markdown 或额外文字）：
{"research":N,"planning":N,"execution":N}`;

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly client: Anthropic;
  private readonly model: string;
  private readonly temperature: number;

  constructor(private readonly configService: ConfigService) {
    this.client = new Anthropic({
      apiKey: this.configService.get<string>('ai.apiKey') ?? this.configService.get<string>('LLM_API_KEY') ?? '',
      baseURL: this.configService.get<string>('ai.baseUrl') ?? this.configService.get<string>('LLM_BASE_URL'),
    });
    this.model = this.configService.get<string>('ai.model') ?? this.configService.get<string>('LLM_MODEL') ?? 'claude-sonnet-4-6';
    this.temperature = this.configService.get<number>('ai.temperature') ?? 0.3;
  }

  async reviewSubmission(input: ReviewInput): Promise<TaskScoreResult> {
    const userMessage = this.buildUserMessage(input);

    // Call LLM 3 times; collect only successful results
    const rawScores: Array<{ research: number; planning: number; execution: number }> = [];
    for (let i = 0; i < 3; i++) {
      const score = await this.callLlmOnce(userMessage);
      if (score !== null) {
        rawScores.push(score);
      }
    }

    if (rawScores.length === 0) {
      throw new Error('AI 评审失败：3 次调用均未成功，任务将重新入队');
    }

    const count = rawScores.length;
    const research = Math.round((rawScores.reduce((s, r) => s + r.research, 0) / count) * 10) / 10;
    const planning = Math.round((rawScores.reduce((s, r) => s + r.planning, 0) / count) * 10) / 10;
    const execution = Math.round((rawScores.reduce((s, r) => s + r.execution, 0) / count) * 10) / 10;
    const average = Math.round(((research + planning + execution) / 3) * 10) / 10;

    return { research, planning, execution, average, rawScores };
  }

  private buildUserMessage(input: ReviewInput): string {
    const typeLabel = {
      explore: '探索/文档类工作（Skill、调研报告等）',
      'ai-exec': 'AI辅助执行类工作（含 AI 工具使用的开发/分析任务）',
      manual: '人工执行类工作（附件、文档、设计稿等）',
    }[input.submissionType];

    return `任务标题：${input.taskTitle}
任务描述：${input.taskDescription ?? '（无描述）'}
提交类型：${typeLabel}

提交内容：
---
${input.submissionContent}
---

请对以上工作成果进行三维度评分，返回 JSON。`;
  }

  private async callLlmOnce(
    userMessage: string,
  ): Promise<{ research: number; planning: number; execution: number } | null> {
    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 100,
        temperature: this.temperature,
        system: SCORING_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('LLM returned non-text content');
      }

      const parsed = JSON.parse(content.text.trim()) as { research: number; planning: number; execution: number };

      // Clamp to 0-5
      return {
        research: Math.max(0, Math.min(5, Math.round(parsed.research))),
        planning: Math.max(0, Math.min(5, Math.round(parsed.planning))),
        execution: Math.max(0, Math.min(5, Math.round(parsed.execution))),
      };
    } catch (error) {
      this.logger.error(`LLM call failed: ${String(error)}`);
      return null;
    }
  }
}
