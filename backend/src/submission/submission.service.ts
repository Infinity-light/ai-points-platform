import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Repository } from 'typeorm';
import type { Queue } from 'bull';
import { Submission, SubmissionType } from './entities/submission.entity';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { TaskService } from '../task/task.service';
import { TaskStatus } from '../task/enums/task-status.enum';
import { QUEUE_NAMES } from '../queue/queue.constants';
import { AI_REVIEW_JOB_NAMES } from '../queue/processors/ai-review.processor';
import { SkillService } from '../skill/skill.service';

@Injectable()
export class SubmissionService {
  constructor(
    @InjectRepository(Submission)
    private readonly submissionRepository: Repository<Submission>,
    @InjectQueue(QUEUE_NAMES.AI_REVIEW)
    private readonly aiReviewQueue: Queue,
    private readonly taskService: TaskService,
    private readonly skillService: SkillService,
  ) {}

  async create(
    tenantId: string,
    submittedBy: string,
    dto: CreateSubmissionDto,
  ): Promise<Submission> {
    // 1. Verify task exists and is in CLAIMED state (assignee submitting)
    const task = await this.taskService.findOne(dto.taskId, tenantId);

    if (task.assigneeId !== submittedBy) {
      throw new BadRequestException('只有任务认领者可以提交');
    }

    if (task.status !== TaskStatus.CLAIMED) {
      throw new BadRequestException(`任务当前状态为 "${task.status}"，不能提交`);
    }

    // 2. Handle skill registration for explore submissions
    let enrichedMetadata: Record<string, unknown> = dto.metadata ?? {};

    if (dto.type === SubmissionType.EXPLORE) {
      const meta = enrichedMetadata;
      const skillName = meta.skillName;

      if (skillName === undefined) {
        throw new BadRequestException('explore 类型提交必须包含 skillName（Skill 名称）');
      }

      if (skillName !== undefined) {
        this.skillService.validateSkillMetadata({
          skillName,
          skillDescription: meta.skillDescription,
          skillContent: meta.skillContent,
        });

        // We need a placeholder submission id for the skill registration;
        // we'll update it after saving the submission
        const placeholderSubmissionId = '00000000-0000-0000-0000-000000000000';
        const { skill, version } = await this.skillService.registerOrUpdateSkill({
          tenantId,
          projectId: task.projectId,
          authorId: submittedBy,
          submissionId: placeholderSubmissionId,
          skillName: skillName as string,
          skillDescription: meta.skillDescription as string,
          skillContent: meta.skillContent as string,
          repoUrl: meta.repoUrl as string | undefined,
        });

        enrichedMetadata = {
          ...enrichedMetadata,
          skillId: skill.id,
          skillVersion: version,
        };
      }
    }

    // 3. Create submission record
    const submission = this.submissionRepository.create({
      tenantId,
      taskId: dto.taskId,
      submittedBy,
      type: dto.type,
      content: dto.content,
      metadata: enrichedMetadata,
      aiReviewStatus: 'pending',
    });
    const saved = await this.submissionRepository.save(submission);

    // Update skill's latestSubmissionId with the real submission id
    if (dto.type === SubmissionType.EXPLORE && enrichedMetadata.skillId) {
      try {
        const skill = await this.skillService.findOne(enrichedMetadata.skillId as string, tenantId);
        skill.latestSubmissionId = saved.id;
        await this.skillService.registerOrUpdateSkill({
          tenantId,
          projectId: task.projectId,
          authorId: submittedBy,
          submissionId: saved.id,
          skillName: skill.name,
          skillDescription: skill.description,
          skillContent: skill.content,
          repoUrl: skill.repoUrl ?? undefined,
        });
      } catch {
        // Non-fatal: latestSubmissionId update failure should not block submission
      }
    }

    // 4. Transition task to SUBMITTED
    await this.taskService.transition(dto.taskId, tenantId, submittedBy, TaskStatus.SUBMITTED);

    // 5. Transition to AI_REVIEWING and queue job
    await this.taskService.transition(dto.taskId, tenantId, submittedBy, TaskStatus.AI_REVIEWING);

    await this.aiReviewQueue.add(AI_REVIEW_JOB_NAMES.REVIEW_SUBMISSION, {
      submissionId: saved.id,
      taskId: task.id,
      tenantId,
      taskTitle: task.title,
      taskDescription: task.description,
      submissionContent: dto.content,
      submissionType: dto.type,
    });

    // Update status to processing
    await this.submissionRepository.update(saved.id, { aiReviewStatus: 'processing' });

    return saved;
  }

  async findByTask(taskId: string, tenantId: string): Promise<Submission[]> {
    return this.submissionRepository.find({
      where: { taskId, tenantId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, tenantId: string): Promise<Submission> {
    const submission = await this.submissionRepository.findOne({ where: { id, tenantId } });
    if (!submission) throw new NotFoundException(`提交记录 ${id} 不存在`);
    return submission;
  }

  async markAiReviewComplete(id: string): Promise<void> {
    await this.submissionRepository.update(id, { aiReviewStatus: 'completed' });
  }

  async markAiReviewFailed(id: string): Promise<void> {
    await this.submissionRepository.update(id, { aiReviewStatus: 'failed' });
  }
}
