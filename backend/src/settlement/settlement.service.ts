import {
  Injectable,
  BadRequestException,
  NotFoundException,
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
import { ReviewMeeting } from '../meeting/entities/review-meeting.entity';
import { TaskContribution } from '../meeting/entities/task-contribution.entity';
import { PointsSnapshot } from '../points/entities/points-snapshot.entity';

// Re-export for use by controller
export { Settlement };

@Injectable()
export class SettlementService {
  constructor(
    @InjectRepository(Settlement)
    private readonly settlementRepository: Repository<Settlement>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(ReviewMeeting)
    private readonly meetingRepository: Repository<ReviewMeeting>,
    @InjectRepository(TaskContribution)
    private readonly contributionRepository: Repository<TaskContribution>,
    @InjectRepository(PointsSnapshot)
    private readonly snapshotRepository: Repository<PointsSnapshot>,
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

  /**
   * 基于评审会议触发结算。
   * 1. 读取 meeting 及其 results（已确认任务的最终分）
   * 2. 获取 project，incrementSettlementRound
   * 3. 遍历每个已确认任务：按 finalScore 计算最终工分，查 task_contributions 分配多人
   * 4. 创建 Settlement 记录
   * 5. 生成 points_snapshots 快照
   * 6. 创建 dividend draft
   */
  async settleFromMeeting(
    meetingId: string,
    tenantId: string,
    triggeredBy: string,
  ): Promise<Settlement> {
    const meeting = await this.meetingRepository.findOne({
      where: { id: meetingId, tenantId },
    });
    if (!meeting) {
      throw new NotFoundException(`评审会议 ${meetingId} 不存在`);
    }
    if (!meeting.results || Object.keys(meeting.results).length === 0) {
      throw new BadRequestException('没有已确认的任务结果，无法结算');
    }

    const project = await this.projectService.incrementSettlementRound(
      meeting.projectId,
      tenantId,
    );
    const newRound = project.settlementRound;

    const settledTaskIds: string[] = [];
    let totalPointsAwarded = 0;
    const affectedUsers = new Set<string>();

    for (const taskId of Object.keys(meeting.results)) {
      const taskResult = meeting.results[taskId];
      if (!taskResult) continue;

      try {
        const task = await this.taskService.findOne(taskId, tenantId);
        const estimatedPoints = task.estimatedPoints ?? task.metadata?.estimatedPoints ?? 10;

        // finalPoints = max(1, round(estimatedPoints × finalScore / 15))
        const qualityRatio = taskResult.finalScore / 15;
        const finalPoints = Math.max(1, Math.round(Number(estimatedPoints) * qualityRatio));

        // 查 task_contributions：有则按比例分配，无则全给 assignee
        const contributions = await this.contributionRepository.find({
          where: { taskId, tenantId },
        });

        if (contributions.length > 0) {
          for (const contrib of contributions) {
            const userPoints = Math.max(
              1,
              Math.round(finalPoints * Number(contrib.percentage) / 100),
            );
            await this.pointsService.awardPoints(
              tenantId,
              contrib.userId,
              project.id,
              userPoints,
              newRound,
              taskId,
              meetingId,
              PoolStatus.PROJECT_ONLY,
            );
            totalPointsAwarded += userPoints;
            affectedUsers.add(contrib.userId);
          }
        } else if (task.assigneeId) {
          await this.pointsService.awardPoints(
            tenantId,
            task.assigneeId,
            project.id,
            finalPoints,
            newRound,
            taskId,
            meetingId,
            PoolStatus.PROJECT_ONLY,
          );
          totalPointsAwarded += finalPoints;
          affectedUsers.add(task.assigneeId);
        }

        await this.taskService.settle(taskId, tenantId, finalPoints);
        settledTaskIds.push(taskId);
      } catch (err) {
        console.error(`Failed to settle task ${taskId}:`, err);
      }
    }

    // 创建 Settlement 记录（voteSessionId 存 meetingId，统一用 uuid 引用）
    const settlement = this.settlementRepository.create({
      tenantId,
      projectId: project.id,
      roundNumber: newRound,
      triggeredBy,
      voteSessionId: meetingId,
      settledTaskIds,
      summary: {
        totalPointsAwarded,
        usersAffected: affectedUsers.size,
      },
    });
    const savedSettlement = await this.settlementRepository.save(settlement);

    // 生成 points_snapshots 快照
    try {
      const members = await this.projectService.getMembers(project.id, tenantId);
      const memberUserIds = members.map((m) => m.userId);

      const users =
        memberUserIds.length > 0
          ? await this.userRepository.find({
              where: { id: In(memberUserIds), tenantId },
            })
          : [];
      const userNames = new Map(users.map((u) => [u.id, u.name]));

      const memberActivePoints = await this.pointsService.getAllMembersActivePoints(
        tenantId,
        project.id,
        memberUserIds,
        newRound,
        project.annealingConfig.cyclesPerStep,
        project.annealingConfig.maxSteps,
      );

      // 按 activePoints 降序排名
      const sorted = [...memberActivePoints.entries()].sort((a, b) => b[1] - a[1]);
      const snapshots = sorted.map(([userId, activePoints], index) => {
        const rawPointsData = users.find((u) => u.id === userId);
        return this.snapshotRepository.create({
          tenantId,
          projectId: project.id,
          settlementId: savedSettlement.id,
          userId,
          userName: userNames.get(userId) ?? rawPointsData?.name ?? '',
          rawPoints: 0, // 从 pointsService 读取实际值
          activePoints,
          rank: index + 1,
        });
      });
      await this.snapshotRepository.save(snapshots);

      // 创建 dividend draft
      await this.dividendService.createDraft({
        tenantId,
        projectId: project.id,
        settlementId: savedSettlement.id,
        roundNumber: newRound,
        memberActivePoints,
        userNames,
      });
    } catch (err) {
      console.error('Failed to create post-meeting snapshot/dividend draft:', err);
    }

    return savedSettlement;
  }

  /**
   * Manual project-level settlement.
   * Finds all completed meetings with unprocessed results for this project
   * and settles them. If no settlable work exists, throws BadRequestException.
   */
  async settleProject(
    projectId: string,
    tenantId: string,
    triggeredBy: string,
  ): Promise<Settlement> {
    // Find meetings with results that haven't been settled yet
    const meetings = await this.meetingRepository.find({
      where: { projectId, tenantId, status: 'closed' as const },
      order: { closedAt: 'DESC' },
    });

    // Collect all task IDs from meeting results that are not yet settled
    const pendingTaskIds: Array<{ taskId: string; finalScore: number; meetingId: string }> = [];
    for (const meeting of meetings) {
      if (!meeting.results) continue;
      for (const [taskId, result] of Object.entries(meeting.results)) {
        if (!result) continue;
        try {
          const task = await this.taskService.findOne(taskId, tenantId);
          if (task.status !== 'settled') {
            pendingTaskIds.push({
              taskId,
              finalScore: (result as { finalScore: number }).finalScore,
              meetingId: meeting.id,
            });
          }
        } catch {
          // Task not found or inaccessible — skip
        }
      }
    }

    if (pendingTaskIds.length === 0) {
      throw new BadRequestException('当前没有待结算的内容');
    }

    // Increment round
    const project = await this.projectService.incrementSettlementRound(projectId, tenantId);
    const newRound = project.settlementRound;

    const settledTaskIds: string[] = [];
    let totalPointsAwarded = 0;
    const affectedUsers = new Set<string>();

    for (const { taskId, finalScore, meetingId } of pendingTaskIds) {
      try {
        const task = await this.taskService.findOne(taskId, tenantId);
        const estimatedPoints = task.estimatedPoints ?? task.metadata?.estimatedPoints ?? 10;
        const qualityRatio = finalScore / 15;
        const finalPoints = Math.max(1, Math.round(Number(estimatedPoints) * qualityRatio));

        // Check contributions for multi-person split
        const contributions = await this.contributionRepository.find({
          where: { taskId, tenantId },
        });

        if (contributions.length > 0) {
          for (const contrib of contributions) {
            const userPoints = Math.max(
              1,
              Math.round(finalPoints * Number(contrib.percentage) / 100),
            );
            await this.pointsService.awardPoints(
              tenantId, contrib.userId, project.id, userPoints,
              newRound, taskId, meetingId, PoolStatus.PROJECT_ONLY,
            );
            totalPointsAwarded += userPoints;
            affectedUsers.add(contrib.userId);
          }
        } else if (task.assigneeId) {
          await this.pointsService.awardPoints(
            tenantId, task.assigneeId, project.id, finalPoints,
            newRound, taskId, meetingId, PoolStatus.PROJECT_ONLY,
          );
          totalPointsAwarded += finalPoints;
          affectedUsers.add(task.assigneeId);
        }

        await this.taskService.settle(taskId, tenantId, finalPoints);
        settledTaskIds.push(taskId);
      } catch (err) {
        console.error(`Failed to settle task ${taskId}:`, err);
      }
    }

    const settlement = this.settlementRepository.create({
      tenantId,
      projectId: project.id,
      roundNumber: newRound,
      triggeredBy,
      settledTaskIds,
      summary: { totalPointsAwarded, usersAffected: affectedUsers.size },
    });
    const savedSettlement = await this.settlementRepository.save(settlement);

    // Create snapshots + dividend draft (non-fatal)
    try {
      const members = await this.projectService.getMembers(project.id, tenantId);
      const memberUserIds = members.map((m) => m.userId);
      const users = memberUserIds.length > 0
        ? await this.userRepository.find({ where: { id: In(memberUserIds), tenantId } })
        : [];
      const userNames = new Map(users.map((u) => [u.id, u.name]));
      const memberActivePoints = await this.pointsService.getAllMembersActivePoints(
        tenantId, project.id, memberUserIds, newRound,
        project.annealingConfig.cyclesPerStep, project.annealingConfig.maxSteps,
      );
      const sorted = [...memberActivePoints.entries()].sort((a, b) => b[1] - a[1]);
      const snapshots = sorted.map(([userId, activePoints], index) =>
        this.snapshotRepository.create({
          tenantId, projectId: project.id, settlementId: savedSettlement.id,
          userId, userName: userNames.get(userId) ?? '',
          rawPoints: 0, activePoints, rank: index + 1,
        }),
      );
      await this.snapshotRepository.save(snapshots);
      await this.dividendService.createDraft({
        tenantId, projectId: project.id, settlementId: savedSettlement.id,
        roundNumber: newRound, memberActivePoints, userNames,
      });
    } catch (err) {
      console.error('Failed to create post-settlement snapshot/dividend draft:', err);
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
