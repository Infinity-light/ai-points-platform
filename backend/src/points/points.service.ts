import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { PointRecord, PointSource, PoolStatus } from './entities/point-record.entity';
import { PointApprovalBatch, PointApprovalBatchStatus } from './entities/point-approval-batch.entity';
import { Project } from '../project/entities/project.entity';
import { User } from '../user/entities/user.entity';
import { ProjectService } from '../project/project.service';
import { calculateActivePoints } from './annealing';

export interface ProjectPointsRow {
  userId: string;
  userName: string;
  originalTotal: number;
  activeTotal: number;
  ratio: number;
}

export interface ProjectPointsTable {
  rows: ProjectPointsRow[];
  totalActive: number;
  totalOriginal: number;
}

export interface MyProjectDetail {
  projectId: string;
  projectName: string;
  originalTotal: number;
  activeTotal: number;
  currentRound: number;
  approvedCount: number;
  pendingCount: number;
  projectOnlyCount: number;
}

@Injectable()
export class PointsService {
  constructor(
    @InjectRepository(PointRecord)
    private readonly pointRepository: Repository<PointRecord>,
    @InjectRepository(PointApprovalBatch)
    private readonly batchRepository: Repository<PointApprovalBatch>,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly projectService: ProjectService,
  ) {}

  async awardPoints(
    tenantId: string,
    userId: string,
    projectId: string,
    originalPoints: number,
    acquiredRound: number,
    taskId: string,
    voteSessionId: string,
    poolStatus: PoolStatus = PoolStatus.APPROVED,
  ): Promise<PointRecord> {
    const record = this.pointRepository.create({
      tenantId,
      userId,
      projectId,
      originalPoints,
      acquiredRound,
      source: PointSource.TASK_SETTLEMENT,
      taskId,
      voteSessionId,
      poolStatus,
    });
    return this.pointRepository.save(record);
  }

  async getUserPointsInProject(
    tenantId: string,
    userId: string,
    projectId: string,
    currentRound: number,
    cyclesPerStep: number,
    maxSteps: number,
  ): Promise<{ originalTotal: number; activeTotal: number; records: PointRecord[] }> {
    const records = await this.pointRepository.find({
      where: { tenantId, userId, projectId },
    });

    let originalTotal = 0;
    let activeTotal = 0;

    for (const record of records) {
      originalTotal += record.originalPoints;
      activeTotal += calculateActivePoints({
        originalPoints: record.originalPoints,
        acquiredRound: record.acquiredRound,
        currentRound,
        cyclesPerStep,
        maxSteps,
      });
    }

    return { originalTotal, activeTotal, records };
  }

  async getAllMembersActivePoints(
    tenantId: string,
    projectId: string,
    memberUserIds: string[],
    currentRound: number,
    cyclesPerStep: number,
    maxSteps: number,
  ): Promise<Map<string, number>> {
    const records = await this.pointRepository.find({
      where: { tenantId, projectId },
    });

    const activePointsByUser = new Map<string, number>();

    // Initialize all members with 0
    for (const userId of memberUserIds) {
      activePointsByUser.set(userId, 0);
    }

    // Sum active points per user
    for (const record of records) {
      if (!memberUserIds.includes(record.userId)) continue;
      const active = calculateActivePoints({
        originalPoints: record.originalPoints,
        acquiredRound: record.acquiredRound,
        currentRound,
        cyclesPerStep,
        maxSteps,
      });
      activePointsByUser.set(record.userId, (activePointsByUser.get(record.userId) ?? 0) + active);
    }

    return activePointsByUser;
  }

  async getMySummary(
    tenantId: string,
    userId: string,
  ): Promise<{ totalPoints: number; activePoints: number; monthlyPoints: number }> {
    const records = await this.pointRepository.find({
      where: { tenantId, userId },
    });

    // Load projects to get per-project settlement round and annealing config
    const projectIds = [...new Set(records.map((r) => r.projectId))];
    const projects =
      projectIds.length > 0
        ? await this.projectRepository.find({
            where: { id: In(projectIds), tenantId },
          })
        : [];
    const projectMap = new Map(projects.map((p) => [p.id, p]));

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    let totalPoints = 0;
    let activePoints = 0;
    let monthlyPoints = 0;

    for (const record of records) {
      totalPoints += record.originalPoints;

      const project = projectMap.get(record.projectId);
      if (project) {
        activePoints += calculateActivePoints({
          originalPoints: record.originalPoints,
          acquiredRound: record.acquiredRound,
          currentRound: project.settlementRound,
          cyclesPerStep: project.annealingConfig.cyclesPerStep,
          maxSteps: project.annealingConfig.maxSteps,
        });
      } else {
        // Project not found (archived/deleted) — treat as full points to avoid data loss
        activePoints += record.originalPoints;
      }

      if (record.createdAt >= startOfMonth) {
        monthlyPoints += record.originalPoints;
      }
    }

    return { totalPoints, activePoints, monthlyPoints };
  }

  async getProjectPointsTable(
    tenantId: string,
    projectId: string,
  ): Promise<ProjectPointsTable> {
    const project = await this.projectService.findOne(projectId, tenantId);
    const members = await this.projectService.getMembers(projectId, tenantId);
    const memberUserIds = members.map((m) => m.userId);

    const [activePointsMap, allRecords, users] = await Promise.all([
      this.getAllMembersActivePoints(
        tenantId,
        projectId,
        memberUserIds,
        project.settlementRound,
        project.annealingConfig.cyclesPerStep,
        project.annealingConfig.maxSteps,
      ),
      this.pointRepository.find({ where: { tenantId, projectId } }),
      memberUserIds.length > 0
        ? this.userRepository.find({ where: { id: In(memberUserIds), tenantId } })
        : Promise.resolve([]),
    ]);

    const userNameMap = new Map(users.map((u) => [u.id, u.name]));

    // Calculate originalTotal per user
    const originalTotalMap = new Map<string, number>();
    for (const userId of memberUserIds) {
      originalTotalMap.set(userId, 0);
    }
    for (const record of allRecords) {
      if (originalTotalMap.has(record.userId)) {
        originalTotalMap.set(record.userId, (originalTotalMap.get(record.userId) ?? 0) + record.originalPoints);
      }
    }

    // Compute ratio
    let totalActivePoints = 0;
    for (const userId of memberUserIds) {
      totalActivePoints += activePointsMap.get(userId) ?? 0;
    }

    const rows: ProjectPointsRow[] = memberUserIds.map((userId) => {
      const activeTotal = activePointsMap.get(userId) ?? 0;
      const ratio = totalActivePoints > 0 ? activeTotal / totalActivePoints : 0;
      return {
        userId,
        userName: userNameMap.get(userId) ?? '',
        originalTotal: originalTotalMap.get(userId) ?? 0,
        activeTotal,
        ratio,
      };
    });

    let totalOriginalPoints = 0;
    for (const row of rows) {
      totalOriginalPoints += row.originalTotal;
    }

    return { rows, totalActive: totalActivePoints, totalOriginal: totalOriginalPoints };
  }

  // T07: Approval batch methods

  async createApprovalBatch(
    tenantId: string,
    projectId: string,
    submittedBy: string,
  ): Promise<PointApprovalBatch> {
    const records = await this.pointRepository.find({
      where: { tenantId, projectId, poolStatus: PoolStatus.PROJECT_ONLY },
    });

    if (records.length === 0) {
      throw new NotFoundException('没有待审批的工分记录（project_only 状态）');
    }

    const totalPoints = records.reduce((sum, r) => sum + r.originalPoints, 0);
    const pointRecordIds = records.map((r) => r.id);

    const batch = this.batchRepository.create({
      tenantId,
      projectId,
      submittedBy,
      pointRecordIds,
      totalPoints,
      status: PointApprovalBatchStatus.PENDING,
    });

    const savedBatch = await this.batchRepository.save(batch);

    // Update all records to pending_approval
    await this.pointRepository
      .createQueryBuilder()
      .update(PointRecord)
      .set({ poolStatus: PoolStatus.PENDING_APPROVAL })
      .whereInIds(pointRecordIds)
      .execute();

    return savedBatch;
  }

  async getApprovalBatch(
    id: string,
    tenantId: string,
  ): Promise<PointApprovalBatch & { records: PointRecord[] }> {
    const batch = await this.batchRepository.findOne({ where: { id, tenantId } });
    if (!batch) throw new NotFoundException(`审批批次 ${id} 不存在`);

    const records = batch.pointRecordIds.length > 0
      ? await this.pointRepository.find({ where: { id: In(batch.pointRecordIds), tenantId } })
      : [];

    return Object.assign(batch, { records });
  }

  async listPendingBatches(tenantId: string): Promise<PointApprovalBatch[]> {
    return this.batchRepository.find({
      where: { tenantId, status: PointApprovalBatchStatus.PENDING },
      order: { createdAt: 'DESC' },
    });
  }

  async approveBatch(
    id: string,
    tenantId: string,
    reviewedBy: string,
  ): Promise<PointApprovalBatch> {
    const batch = await this.batchRepository.findOne({ where: { id, tenantId } });
    if (!batch) throw new NotFoundException(`审批批次 ${id} 不存在`);

    batch.status = PointApprovalBatchStatus.APPROVED;
    batch.reviewedBy = reviewedBy;

    if (batch.pointRecordIds.length > 0) {
      await this.pointRepository
        .createQueryBuilder()
        .update(PointRecord)
        .set({ poolStatus: PoolStatus.APPROVED })
        .whereInIds(batch.pointRecordIds)
        .execute();
    }

    return this.batchRepository.save(batch);
  }

  async rejectBatch(
    id: string,
    tenantId: string,
    reviewedBy: string,
    note?: string,
  ): Promise<PointApprovalBatch> {
    const batch = await this.batchRepository.findOne({ where: { id, tenantId } });
    if (!batch) throw new NotFoundException(`审批批次 ${id} 不存在`);

    batch.status = PointApprovalBatchStatus.REJECTED;
    batch.reviewedBy = reviewedBy;
    batch.reviewNote = note ?? null;

    if (batch.pointRecordIds.length > 0) {
      await this.pointRepository
        .createQueryBuilder()
        .update(PointRecord)
        .set({ poolStatus: PoolStatus.PROJECT_ONLY })
        .whereInIds(batch.pointRecordIds)
        .execute();
    }

    return this.batchRepository.save(batch);
  }

  // T08: Profile points detail

  async getMyProjectsDetail(
    tenantId: string,
    userId: string,
  ): Promise<MyProjectDetail[]> {
    const records = await this.pointRepository.find({
      where: { tenantId, userId },
    });

    const projectIds = [...new Set(records.map((r) => r.projectId))];
    if (projectIds.length === 0) return [];

    const projects = await this.projectRepository.find({
      where: { id: In(projectIds), tenantId },
    });

    const result: MyProjectDetail[] = [];

    for (const project of projects) {
      const projectRecords = records.filter((r) => r.projectId === project.id);

      let originalTotal = 0;
      let activeTotal = 0;
      let approvedCount = 0;
      let pendingCount = 0;
      let projectOnlyCount = 0;

      for (const record of projectRecords) {
        originalTotal += record.originalPoints;
        activeTotal += calculateActivePoints({
          originalPoints: record.originalPoints,
          acquiredRound: record.acquiredRound,
          currentRound: project.settlementRound,
          cyclesPerStep: project.annealingConfig.cyclesPerStep,
          maxSteps: project.annealingConfig.maxSteps,
        });

        if (record.poolStatus === PoolStatus.APPROVED) approvedCount++;
        else if (record.poolStatus === PoolStatus.PENDING_APPROVAL) pendingCount++;
        else if (record.poolStatus === PoolStatus.PROJECT_ONLY) projectOnlyCount++;
      }

      result.push({
        projectId: project.id,
        projectName: project.name,
        originalTotal,
        activeTotal,
        currentRound: project.settlementRound,
        approvedCount,
        pendingCount,
        projectOnlyCount,
      });
    }

    return result;
  }
}
