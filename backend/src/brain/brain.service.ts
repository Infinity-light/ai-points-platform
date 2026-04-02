import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { BrainConversation, ChatMessage } from './entities/brain-conversation.entity';
import { TaskService } from '../task/task.service';
import { ProjectService } from '../project/project.service';
import { PointsService } from '../points/points.service';
import { SkillService } from '../skill/skill.service';
import { Submission, SubmissionType } from '../submission/entities/submission.entity';
import { Response } from 'express';

@Injectable()
export class BrainService {
  private readonly logger = new Logger(BrainService.name);
  private readonly client: Anthropic;
  private readonly model: string;

  constructor(
    @InjectRepository(BrainConversation)
    private readonly conversationRepository: Repository<BrainConversation>,
    @InjectRepository(Submission)
    private readonly submissionRepository: Repository<Submission>,
    private readonly taskService: TaskService,
    private readonly projectService: ProjectService,
    private readonly pointsService: PointsService,
    private readonly skillService: SkillService,
    private readonly configService: ConfigService,
  ) {
    this.client = new Anthropic({
      apiKey: this.configService.get<string>('LLM_API_KEY') ?? '',
      baseURL: this.configService.get<string>('LLM_BASE_URL'),
    });
    this.model = this.configService.get<string>('LLM_MODEL') ?? 'claude-sonnet-4-6';
  }

  async getOrCreateConversation(
    tenantId: string,
    projectId: string,
    userId: string,
  ): Promise<BrainConversation> {
    let conv = await this.conversationRepository.findOne({
      where: { tenantId, projectId, userId },
    });

    if (!conv) {
      conv = this.conversationRepository.create({
        tenantId,
        projectId,
        userId,
        messages: [],
      });
      conv = await this.conversationRepository.save(conv);
    }

    return conv;
  }

  async clearConversation(tenantId: string, projectId: string, userId: string): Promise<void> {
    const conv = await this.conversationRepository.findOne({
      where: { tenantId, projectId, userId },
    });
    if (conv) {
      conv.messages = [];
      await this.conversationRepository.save(conv);
    }
  }

  /**
   * Build system prompt with project context, points, submissions, and skills
   */
  private async buildSystemPrompt(projectId: string, tenantId: string): Promise<string> {
    const project = await this.projectService.findOne(projectId, tenantId);
    const tasks = await this.taskService.findAll(tenantId, projectId);

    const taskSummary = tasks.slice(0, 50).map((t) =>
      `- [${t.status}] ${t.title}${t.assigneeId ? ' (已认领)' : ' (待认领)'}${t.metadata?.finalPoints ? ` ${t.metadata.finalPoints}分` : ''}`
    ).join('\n');

    // Fetch points distribution
    let pointsSummary = '（暂无工分数据）';
    try {
      const pointsTable = await this.pointsService.getProjectPointsTable(tenantId, projectId);
      if (pointsTable.rows.length > 0) {
        pointsSummary = pointsTable.rows.slice(0, 20).map((m) =>
          `- ${m.userName}: 活跃工分 ${m.activeTotal}（历史 ${m.originalTotal}，占比 ${(m.ratio * 100).toFixed(1)}%）`
        ).join('\n');
      }
    } catch {
      pointsSummary = '（获取工分数据失败）';
    }

    // Fetch recent submissions
    let submissionSummary = '（暂无提交记录）';
    try {
      const recentSubmissions = await this.submissionRepository.find({
        where: { tenantId },
        order: { createdAt: 'DESC' },
        take: 10,
      });
      if (recentSubmissions.length > 0) {
        const typeLabels: Record<string, string> = {
          [SubmissionType.EXPLORE]: 'Skill/文档',
          [SubmissionType.AI_EXEC]: 'AI执行',
          [SubmissionType.MANUAL]: '人工',
        };
        submissionSummary = recentSubmissions.map((s) =>
          `- [${typeLabels[s.type] ?? s.type}] ${s.content.slice(0, 80)}${s.content.length > 80 ? '...' : ''} (AI评审: ${s.aiReviewStatus})`
        ).join('\n');
      }
    } catch {
      submissionSummary = '（获取提交记录失败）';
    }

    // Fetch skill catalog
    let skillSummary = '（暂无 Skill）';
    try {
      const skills = await this.skillService.findForProject(tenantId, projectId);
      if (skills.length > 0) {
        skillSummary = skills.slice(0, 20).map((s) =>
          `- ${s.name} (v${s.version}): ${s.description.slice(0, 60)}${s.description.length > 60 ? '...' : ''}`
        ).join('\n');
      }
    } catch {
      skillSummary = '（获取 Skill 数据失败）';
    }

    return `你是「${project.name}」项目的 AI 智脑助手。你的职责是帮助项目团队：
1. 分析项目现状和工分分布，提出任务建议
2. 回答项目相关问题（任务、工分、Skill、贡献分析）
3. 协助团队规划工作和任务分派

项目信息：
- 名称：${project.name}
- 描述：${project.description ?? '（暂无）'}
- 当前结算轮次：第 ${project.settlementRound} 轮
- 结算周期：${project.settlementConfig.periodType === 'weekly' ? '每周' : '每月'}

当前任务表（最多50条）：
${taskSummary || '（暂无任务）'}

团队工分分布（活跃工分排行）：
${pointsSummary}

近期提交记录（最近10条）：
${submissionSummary}

项目 Skill 库：
${skillSummary}

你可以：
- 分析团队工分分布，识别贡献不均衡问题
- 建议新任务（说明：推荐创建任务「xxx」，预估工分：N）
- 分析任务完成情况和提交质量趋势
- 推荐合适的 Skill 给团队成员
- 识别需要关注的成员（工分下滑、长期未提交等）
- 提出优化建议

保持专业、简洁、建设性。用中文回复。`;
  }

  /**
   * Stream chat via SSE
   */
  async streamChat(
    tenantId: string,
    projectId: string,
    userId: string,
    userMessage: string,
    res: Response,
  ): Promise<void> {
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    try {
      const conv = await this.getOrCreateConversation(tenantId, projectId, userId);
      const systemPrompt = await this.buildSystemPrompt(projectId, tenantId);

      // Add user message to history
      const userMsg: ChatMessage = {
        role: 'user',
        content: userMessage,
        timestamp: new Date().toISOString(),
      };
      conv.messages.push(userMsg);

      // Build messages for API (last 20 for context window)
      const apiMessages = conv.messages.slice(-20).map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

      let fullResponse = '';

      // Stream from Claude
      const stream = this.client.messages.stream({
        model: this.model,
        max_tokens: 2048,
        system: systemPrompt,
        messages: apiMessages,
      });

      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          const text = chunk.delta.text;
          fullResponse += text;
          res.write(`data: ${JSON.stringify({ type: 'delta', content: text })}\n\n`);
        }
      }

      // Save assistant response to history
      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: fullResponse,
        timestamp: new Date().toISOString(),
      };
      conv.messages.push(assistantMsg);

      // Keep history limited to 100 messages
      if (conv.messages.length > 100) {
        conv.messages = conv.messages.slice(-100);
      }

      await this.conversationRepository.save(conv);

      res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    } catch (error) {
      this.logger.error(`Brain stream error: ${String(error)}`);
      res.write(`data: ${JSON.stringify({ type: 'error', message: '对话出错，请重试' })}\n\n`);
    } finally {
      res.end();
    }
  }

  /**
   * Suggest and optionally create tasks based on brain analysis
   */
  async suggestTasks(
    tenantId: string,
    projectId: string,
    userId: string,
    instruction: string,
  ): Promise<Array<{ title: string; description: string }>> {
    const project = await this.projectService.findOne(projectId, tenantId);
    const tasks = await this.taskService.findAll(tenantId, projectId);

    const existingTitles = tasks.map((t) => t.title).join('\n');

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 1000,
      system: `你是项目「${project.name}」的任务规划助手。根据指令生成任务建议。
已有任务：
${existingTitles || '（暂无）'}

返回严格的 JSON 数组格式：
[{"title":"任务标题","description":"任务描述"}]
只返回 JSON，不要其他文字。`,
      messages: [{ role: 'user', content: instruction }],
    });

    const content = response.content[0];
    if (content.type !== 'text') return [];

    try {
      const parsed = JSON.parse(content.text.trim()) as Array<{
        title: string;
        description: string;
      }>;
      return Array.isArray(parsed) ? parsed.slice(0, 10) : [];
    } catch {
      return [];
    }
  }

  async createTasksFromSuggestions(
    tenantId: string,
    projectId: string,
    createdBy: string,
    suggestions: Array<{ title: string; description?: string }>,
  ): Promise<number> {
    let created = 0;
    for (const s of suggestions) {
      try {
        await this.taskService.create(tenantId, projectId, createdBy, {
          title: s.title,
          description: s.description,
        });
        created++;
      } catch {
        // continue
      }
    }
    return created;
  }
}
