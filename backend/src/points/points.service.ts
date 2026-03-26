import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PointRecord, PointSource } from './entities/point-record.entity';
import { calculateActivePoints } from './annealing';

@Injectable()
export class PointsService {
  constructor(
    @InjectRepository(PointRecord)
    private readonly pointRepository: Repository<PointRecord>,
  ) {}

  async awardPoints(
    tenantId: string,
    userId: string,
    projectId: string,
    originalPoints: number,
    acquiredRound: number,
    taskId: string,
    voteSessionId: string,
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

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    let totalPoints = 0;
    let monthlyPoints = 0;

    for (const record of records) {
      totalPoints += record.originalPoints;
      if (record.createdAt >= startOfMonth) {
        monthlyPoints += record.originalPoints;
      }
    }

    // activePoints: simplified — use totalPoints (annealing requires per-project round context)
    return { totalPoints, activePoints: totalPoints, monthlyPoints };
  }
}
