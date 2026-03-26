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

@Injectable()
export class SubmissionService {
  constructor(
    @InjectRepository(Submission)
    private readonly submissionRepository: Repository<Submission>,
    @InjectQueue(QUEUE_NAMES.AI_REVIEW)
    private readonly aiReviewQueue: Queue,
    private readonly taskService: TaskService,
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

    // 2. Create submission record
    const submission = this.submissionRepository.create({
      tenantId,
      taskId: dto.taskId,
      submittedBy,
      type: dto.type,
      content: dto.content,
      metadata: dto.metadata ?? {},
      aiReviewStatus: 'pending',
    });
    const saved = await this.submissionRepository.save(submission);

    // 3. Transition task to SUBMITTED
    await this.taskService.transition(dto.taskId, tenantId, submittedBy, TaskStatus.SUBMITTED);

    // 4. Transition to AI_REVIEWING and queue job
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
