import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VoteSession, VoteSessionStatus } from './entities/vote-session.entity';
import { VoteRecord } from './entities/vote-record.entity';
import { PointsService } from '../points/points.service';
import { ProjectService } from '../project/project.service';

const MIN_BASE_WEIGHT = 1; // 活跃工分为0时的基础票权

@Injectable()
export class VoteService {
  constructor(
    @InjectRepository(VoteSession)
    private readonly voteSessionRepository: Repository<VoteSession>,
    @InjectRepository(VoteRecord)
    private readonly voteRecordRepository: Repository<VoteRecord>,
    private readonly pointsService: PointsService,
    private readonly projectService: ProjectService,
  ) {}

  async createSession(
    tenantId: string,
    projectId: string,
    createdBy: string,
    taskIds: string[],
  ): Promise<VoteSession> {
    if (taskIds.length === 0) throw new BadRequestException('至少需要一个待投票任务');

    const session = this.voteSessionRepository.create({
      tenantId,
      projectId,
      createdBy,
      taskIds,
      status: VoteSessionStatus.OPEN,
    });
    return this.voteSessionRepository.save(session);
  }

  async castVote(
    sessionId: string,
    tenantId: string,
    userId: string,
    vote: boolean,
  ): Promise<VoteRecord> {
    const session = await this.getSession(sessionId, tenantId);
    if (session.status !== VoteSessionStatus.OPEN) {
      throw new BadRequestException('投票会话已关闭');
    }

    // Check not already voted
    const existing = await this.voteRecordRepository.findOne({ where: { voteSessionId: sessionId, userId } });
    if (existing) throw new ConflictException('您已经投过票了');

    // Calculate this user's weight
    const project = await this.projectService.findOne(session.projectId, tenantId);
    const members = await this.projectService.getMembers(session.projectId, tenantId);
    const memberUserIds = members.map((m) => m.userId);

    const activePointsMap = await this.pointsService.getAllMembersActivePoints(
      tenantId,
      session.projectId,
      memberUserIds,
      project.settlementRound,
      project.annealingConfig.cyclesPerStep,
      project.annealingConfig.maxSteps,
    );

    const userActivePoints = activePointsMap.get(userId) ?? 0;
    const weight = userActivePoints > 0 ? userActivePoints : MIN_BASE_WEIGHT;

    const record = this.voteRecordRepository.create({
      voteSessionId: sessionId,
      userId,
      tenantId,
      vote,
      weight,
    });
    return this.voteRecordRepository.save(record);
  }

  async closeSession(sessionId: string, tenantId: string): Promise<VoteSession> {
    const session = await this.getSession(sessionId, tenantId);
    if (session.status !== VoteSessionStatus.OPEN) {
      throw new BadRequestException('投票会话已关闭');
    }

    // Get all vote records
    const records = await this.voteRecordRepository.find({ where: { voteSessionId: sessionId } });

    // Get member count for participation check
    const members = await this.projectService.getMembers(session.projectId, tenantId);
    const totalMemberCount = members.length;

    // Calculate result
    let totalWeight = 0;
    let yesWeight = 0;
    let noWeight = 0;

    for (const record of records) {
      const w = Number(record.weight);
      totalWeight += w;
      if (record.vote) {
        yesWeight += w;
      } else {
        noWeight += w;
      }
    }

    const participantCount = records.length;
    const participationRatio = totalMemberCount > 0 ? participantCount / totalMemberCount : 0;
    const weightedYesRatio = totalWeight > 0 ? yesWeight / totalWeight : 0;

    // Pass criteria: weighted yes > 50% AND participation > 50%
    const passed = weightedYesRatio > 0.5 && participationRatio > 0.5;

    session.status = passed ? VoteSessionStatus.PASSED : VoteSessionStatus.FAILED;
    session.result = {
      totalWeight,
      yesWeight,
      noWeight,
      participantCount,
      totalMemberCount,
      weightedYesRatio,
      participationRatio,
    };

    return this.voteSessionRepository.save(session);
  }

  async getSession(id: string, tenantId: string): Promise<VoteSession> {
    const session = await this.voteSessionRepository.findOne({ where: { id, tenantId } });
    if (!session) throw new NotFoundException(`投票会话 ${id} 不存在`);
    return session;
  }

  async getSessionsForProject(tenantId: string, projectId: string): Promise<VoteSession[]> {
    return this.voteSessionRepository.find({
      where: { tenantId, projectId },
      order: { createdAt: 'DESC' },
    });
  }

  async getVotesForSession(sessionId: string, tenantId: string): Promise<VoteRecord[]> {
    await this.getSession(sessionId, tenantId);
    return this.voteRecordRepository.find({ where: { voteSessionId: sessionId } });
  }

  /**
   * Calculate weighted vote weight for a user (pure calculation, exposed for testing)
   */
  calculateWeight(userActivePoints: number): number {
    return userActivePoints > 0 ? userActivePoints : MIN_BASE_WEIGHT;
  }
}
