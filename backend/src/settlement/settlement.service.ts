import {
  Injectable,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Settlement } from './entities/settlement.entity';
import { VoteService } from '../vote/vote.service';
import { VoteSessionStatus } from '../vote/entities/vote-session.entity';
import { TaskService } from '../task/task.service';
import { PointsService } from '../points/points.service';
import { PoolStatus } from '../points/entities/point-record.entity';
import { ProjectService } from '../project/project.service';
import { DividendService } from '../dividend/dividend.service';
import { User } from '../user/entities/user.entity';

// Re-export for use by controller
export { Settlement };

@Injectable()
export class SettlementService {
  constructor(
    @InjectRepository(Settlement)
    private readonly settlementRepository: Repository<Settlement>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly voteService: VoteService,
    private readonly taskService: TaskService,
    private readonly pointsService: PointsService,
    private readonly projectService: ProjectService,
    private readonly dividendService: DividendService,
  ) {}

  /**
   * Trigger settlement for a passed vote session.
   * Steps:
   * 1. Verify vote session PASSED
   * 2. Increment project settlement round
   * 3. For each task in the session, settle it and award points to assignee
   * 4. Create settlement record
   */
  async triggerSettlement(
    voteSessionId: string,
    tenantId: string,
    triggeredBy: string,
  ): Promise<Settlement> {
    // 1. Get and validate vote session
    const session = await this.voteService.getSession(voteSessionId, tenantId);
    if (session.status !== VoteSessionStatus.PASSED) {
      throw new BadRequestException('只能对已通过的投票会话执行结算');
    }

    // 2. Get project and increment round
    const project = await this.projectService.incrementSettlementRound(session.projectId, tenantId);
    const newRound = project.settlementRound;

    // 3. Settle each task and award points
    const settledTaskIds: string[] = [];
    let totalPointsAwarded = 0;
    const affectedUsers = new Set<string>();

    for (const taskId of session.taskIds) {
      try {
        const task = await this.taskService.findOne(taskId, tenantId);

        // Derive final points from AI scores when available.
        // Formula: estimatedPoints × (aiTotal / 15), min 1 point.
        // Fallback: estimatedPoints when AI review was skipped or failed.
        const aiScores = task.metadata.aiScores;
        let finalPoints: number;
        if (
          aiScores &&
          typeof aiScores.research === 'number' &&
          typeof aiScores.planning === 'number' &&
          typeof aiScores.execution === 'number'
        ) {
          const aiTotal = aiScores.research + aiScores.planning + aiScores.execution; // 0–15
          const qualityRatio = aiTotal / 15;
          finalPoints = Math.max(1, Math.round((task.estimatedPoints ?? 10) * qualityRatio));
        } else {
          finalPoints = task.estimatedPoints ?? 10;
        }

        // Settle the task
        await this.taskService.settle(taskId, tenantId, finalPoints);

        // Award points to assignee
        if (task.assigneeId) {
          await this.pointsService.awardPoints(
            tenantId,
            task.assigneeId,
            project.id,
            finalPoints,
            newRound, // Acquired at this new round
            taskId,
            voteSessionId,
            PoolStatus.PROJECT_ONLY,
          );
          totalPointsAwarded += finalPoints;
          affectedUsers.add(task.assigneeId);
        }

        settledTaskIds.push(taskId);
      } catch (err) {
        // Log but continue with other tasks
        console.error(`Failed to settle task ${taskId}:`, err);
      }
    }

    // 4. Create settlement record
    const settlement = this.settlementRepository.create({
      tenantId,
      projectId: project.id,
      roundNumber: newRound,
      triggeredBy,
      voteSessionId,
      settledTaskIds,
      summary: {
        totalPointsAwarded,
        usersAffected: affectedUsers.size,
      },
    });

    const savedSettlement = await this.settlementRepository.save(settlement);

    // 5. Create dividend draft for this settlement round
    try {
      const members = await this.projectService.getMembers(project.id, tenantId);
      const memberUserIds = members.map((m) => m.userId);

      const memberActivePoints = await this.pointsService.getAllMembersActivePoints(
        tenantId,
        project.id,
        memberUserIds,
        newRound,
        project.annealingConfig.cyclesPerStep,
        project.annealingConfig.maxSteps,
      );

      const users = memberUserIds.length > 0
        ? await this.userRepository.find({ where: { id: In(memberUserIds), tenantId } })
        : [];
      const userNames = new Map(users.map((u) => [u.id, u.name]));

      await this.dividendService.createDraft({
        tenantId,
        projectId: project.id,
        settlementId: savedSettlement.id,
        roundNumber: newRound,
        memberActivePoints,
        userNames,
      });
    } catch (err) {
      // Non-fatal: dividend draft creation failure should not block settlement
      console.error('Failed to create dividend draft after settlement:', err);
    }

    return savedSettlement;
  }

  async findForProject(tenantId: string, projectId: string): Promise<Settlement[]> {
    return this.settlementRepository.find({
      where: { tenantId, projectId },
      order: { createdAt: 'DESC' },
    });
  }
}
