import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReviewMeeting, MeetingTaskResult } from './entities/review-meeting.entity';
import { ReviewVote } from './entities/review-vote.entity';
import { TaskContribution } from './entities/task-contribution.entity';
import { Task } from '../task/entities/task.entity';
import { TaskStatus } from '../task/enums/task-status.enum';

export interface VoteStatsResult {
  taskId: string;
  approvalCount: number;
  challengeCount: number;
  voteCount: number;
  medianScore: number | null;
}

export interface CastVoteDto {
  points: number;
}

export interface ContributionEntry {
  userId: string;
  percentage: number;
}

/**
 * 计算一组数值的中位数，偶数取两中间值平均并四舍五入
 */
function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[mid];
  }
  return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

@Injectable()
export class MeetingService {
  constructor(
    @InjectRepository(ReviewMeeting)
    private readonly meetingRepository: Repository<ReviewMeeting>,
    @InjectRepository(ReviewVote)
    private readonly voteRepository: Repository<ReviewVote>,
    @InjectRepository(TaskContribution)
    private readonly contributionRepository: Repository<TaskContribution>,
    @InjectRepository(Task)
    private readonly taskRepository: Repository<Task>,
  ) {}

  async createMeeting(opts: {
    tenantId: string;
    projectId: string;
    createdBy: string;
  }): Promise<ReviewMeeting> {
    const { tenantId, projectId, createdBy } = opts;

    const pendingTasks = await this.taskRepository.find({
      where: { tenantId, projectId, status: TaskStatus.PENDING_REVIEW },
    });

    const taskIds = pendingTasks.map((t) => t.id);

    const meeting = this.meetingRepository.create({
      tenantId,
      projectId,
      createdBy,
      status: 'open',
      taskIds,
      results: null,
      participantCount: 0,
      closedAt: null,
    });

    return this.meetingRepository.save(meeting);
  }

  async castVote(opts: {
    meetingId: string;
    taskId: string;
    userId: string;
    tenantId: string;
    dto: CastVoteDto;
  }): Promise<VoteStatsResult> {
    const { meetingId, taskId, userId, tenantId, dto } = opts;

    const meeting = await this.getMeetingOrFail(meetingId, tenantId);
    if (meeting.status !== 'open') {
      throw new BadRequestException('会议已关闭，无法投票');
    }

    if (dto.points < 0 || !Number.isInteger(dto.points)) {
      throw new BadRequestException('工分必须为非负整数');
    }

    // 查找已有投票（UNIQUE 约束确保一票，这里用 upsert 逻辑）
    const existing = await this.voteRepository.findOne({
      where: { meetingId, taskId, userId },
    });

    if (existing) {
      existing.score = dto.points;
      existing.isApproval = false;
      await this.voteRepository.save(existing);
    } else {
      const vote = this.voteRepository.create({
        meetingId,
        taskId,
        userId,
        tenantId,
        score: dto.points,
        isApproval: false,
      });
      await this.voteRepository.save(vote);
    }

    return this.getVoteStats(meetingId, taskId);
  }

  async setContributions(opts: {
    meetingId: string;
    taskId: string;
    tenantId: string;
    contributions: ContributionEntry[];
  }): Promise<TaskContribution[]> {
    const { meetingId, taskId, tenantId, contributions } = opts;

    // 删除该 task 的旧 contributions
    await this.contributionRepository.delete({ taskId, setInMeetingId: meetingId });

    // 批量插入新的
    const entities = contributions.map((c) =>
      this.contributionRepository.create({
        taskId,
        userId: c.userId,
        tenantId,
        percentage: c.percentage,
        setInMeetingId: meetingId,
      }),
    );

    return this.contributionRepository.save(entities);
  }

  async confirmTask(opts: {
    meetingId: string;
    taskId: string;
    tenantId: string;
  }): Promise<MeetingTaskResult> {
    const { meetingId, taskId, tenantId } = opts;

    const meeting = await this.getMeetingOrFail(meetingId, tenantId);

    const votes = await this.voteRepository.find({
      where: { meetingId, taskId },
    });

    const voteCount = votes.length;
    const approvalCount = 0; // legacy field, kept for backward compat
    const challengeCount = voteCount;

    const scores = votes.map((v) => Number(v.score));
    const medianScore = voteCount > 0 ? calculateMedian(scores) : 0;
    const finalScore = medianScore;

    const result: MeetingTaskResult = {
      finalScore,
      voteCount,
      approvalCount,
      challengeCount,
      medianScore,
    };

    // 写入 meeting.results JSONB
    const currentResults = meeting.results ?? {};
    meeting.results = { ...currentResults, [taskId]: result };
    await this.meetingRepository.save(meeting);

    return result;
  }

  async closeMeeting(opts: {
    meetingId: string;
    tenantId: string;
    closedBy: string;
  }): Promise<ReviewMeeting> {
    const { meetingId, tenantId } = opts;

    const meeting = await this.getMeetingOrFail(meetingId, tenantId);
    if (meeting.status !== 'open') {
      throw new BadRequestException('会议已关闭或已取消');
    }

    // 统计实际参与人数（投票过的不重复用户）
    const votes = await this.voteRepository.find({ where: { meetingId } });
    const participantSet = new Set(votes.map((v) => v.userId));

    meeting.status = 'closed';
    meeting.closedAt = new Date();
    meeting.participantCount = participantSet.size;

    return this.meetingRepository.save(meeting);
  }

  async getMeeting(meetingId: string, tenantId: string): Promise<ReviewMeeting> {
    const meeting = await this.meetingRepository.findOne({
      where: { id: meetingId, tenantId },
      relations: ['votes', 'contributions'],
    });
    if (!meeting) {
      throw new NotFoundException(`评审会议 ${meetingId} 不存在`);
    }
    return meeting;
  }

  async listMeetings(opts: {
    tenantId: string;
    projectId?: string;
  }): Promise<ReviewMeeting[]> {
    const { tenantId, projectId } = opts;
    const where = projectId
      ? { tenantId, projectId }
      : { tenantId };
    return this.meetingRepository.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  private async getMeetingOrFail(
    meetingId: string,
    tenantId: string,
  ): Promise<ReviewMeeting> {
    const meeting = await this.meetingRepository.findOne({
      where: { id: meetingId, tenantId },
    });
    if (!meeting) {
      throw new NotFoundException(`评审会议 ${meetingId} 不存在`);
    }
    return meeting;
  }

  private async getVoteStats(
    meetingId: string,
    taskId: string,
  ): Promise<VoteStatsResult> {
    const votes = await this.voteRepository.find({ where: { meetingId, taskId } });
    const voteCount = votes.length;
    const approvalCount = 0;
    const challengeCount = voteCount;

    const scores = votes.map((v) => Number(v.score));
    const medianScore = scores.length > 0 ? calculateMedian(scores) : null;

    return { taskId, approvalCount, challengeCount, voteCount, medianScore };
  }
}
