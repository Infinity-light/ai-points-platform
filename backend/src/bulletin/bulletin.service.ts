import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PointsSnapshot } from '../points/entities/points-snapshot.entity';
import { Settlement } from '../settlement/entities/settlement.entity';
import { Dividend } from '../dividend/entities/dividend.entity';
import { ReviewMeeting } from '../meeting/entities/review-meeting.entity';
import { ReviewVote } from '../meeting/entities/review-vote.entity';
import { AuditLog } from '../audit/entities/audit-log.entity';
import { Tenant } from '../tenant/entities/tenant.entity';

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  userName: string;
  rawPoints: number;
  activePoints: number;
}

export interface LeaderboardResult {
  projectId: string | null;
  settlementId: string | null;
  entries: LeaderboardEntry[];
  snapshotAt: Date | null;
}

export interface AuditTrailEntry {
  id: string;
  actorName: string;
  action: string;
  resource: string;
  resourceId: string | null;
  createdAt: Date;
  previousData: Record<string, unknown> | null;
  newData: Record<string, unknown> | null;
}

export interface DecisionEntry {
  meetingId: string;
  projectId: string;
  status: string;
  taskCount: number;
  participantCount: number;
  createdAt: Date;
  closedAt: Date | null;
  results: Record<string, unknown> | null;
}

@Injectable()
export class BulletinService {
  constructor(
    @InjectRepository(PointsSnapshot)
    private readonly snapshotRepo: Repository<PointsSnapshot>,
    @InjectRepository(Settlement)
    private readonly settlementRepo: Repository<Settlement>,
    @InjectRepository(Dividend)
    private readonly dividendRepo: Repository<Dividend>,
    @InjectRepository(ReviewMeeting)
    private readonly meetingRepo: Repository<ReviewMeeting>,
    @InjectRepository(ReviewVote)
    private readonly voteRepo: Repository<ReviewVote>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
  ) {}

  /**
   * 获取排行榜：读取 points_snapshots 最新一条
   */
  async getLeaderboard(opts: {
    tenantId: string;
    projectId?: string;
    sanitize?: boolean;
  }): Promise<LeaderboardResult> {
    const { tenantId, projectId, sanitize = false } = opts;

    // 找最近一次 settlement 的 snapshot
    const qb = this.snapshotRepo
      .createQueryBuilder('snap')
      .where('snap.tenantId = :tenantId', { tenantId })
      .orderBy('snap.createdAt', 'DESC');

    if (projectId) {
      qb.andWhere('snap.projectId = :projectId', { projectId });
    }

    // Get the latest settlementId first
    const latest = await qb.getOne();
    if (!latest) {
      return { projectId: projectId ?? null, settlementId: null, entries: [], snapshotAt: null };
    }

    const snapshots = await this.snapshotRepo.find({
      where: {
        tenantId,
        settlementId: latest.settlementId,
        ...(projectId ? { projectId } : {}),
      },
      order: { rank: 'ASC' },
    });

    const entries: LeaderboardEntry[] = snapshots.map((s) => ({
      rank: s.rank ?? 0,
      userId: sanitize ? '' : s.userId,
      userName: sanitize ? this.sanitizeName(s.userName) : s.userName,
      rawPoints: s.rawPoints,
      activePoints: s.activePoints,
    }));

    return {
      projectId: latest.projectId,
      settlementId: latest.settlementId,
      entries,
      snapshotAt: latest.createdAt,
    };
  }

  /**
   * 结算记录列表（分页）
   */
  async getSettlements(opts: {
    tenantId: string;
    page: number;
    limit: number;
  }): Promise<PaginatedResult<Settlement>> {
    const { tenantId, page, limit } = opts;
    const offset = (page - 1) * limit;

    const [data, total] = await this.settlementRepo.findAndCount({
      where: { tenantId },
      order: { createdAt: 'DESC' },
      skip: offset,
      take: limit,
    });

    return { data, meta: { total, page, limit } };
  }

  /**
   * 分红记录列表（分页）
   */
  async getDividends(opts: {
    tenantId: string;
    page: number;
    limit: number;
  }): Promise<PaginatedResult<Dividend>> {
    const { tenantId, page, limit } = opts;
    const offset = (page - 1) * limit;

    const [data, total] = await this.dividendRepo.findAndCount({
      where: { tenantId },
      order: { createdAt: 'DESC' },
      skip: offset,
      take: limit,
    });

    return { data, meta: { total, page, limit } };
  }

  /**
   * 决策记录（评审会议 + 投票情况）分页
   */
  async getDecisions(opts: {
    tenantId: string;
    page: number;
    limit: number;
  }): Promise<PaginatedResult<DecisionEntry>> {
    const { tenantId, page, limit } = opts;
    const offset = (page - 1) * limit;

    const [meetings, total] = await this.meetingRepo.findAndCount({
      where: { tenantId },
      order: { createdAt: 'DESC' },
      skip: offset,
      take: limit,
    });

    const data: DecisionEntry[] = meetings.map((m) => ({
      meetingId: m.id,
      projectId: m.projectId,
      status: m.status,
      taskCount: m.taskIds.length,
      participantCount: m.participantCount,
      createdAt: m.createdAt,
      closedAt: m.closedAt,
      results: m.results as Record<string, unknown> | null,
    }));

    return { data, meta: { total, page, limit } };
  }

  /**
   * 审计轨迹（简化版，分页）
   */
  async getAuditTrail(opts: {
    tenantId: string;
    page: number;
    limit: number;
    sanitize?: boolean;
  }): Promise<PaginatedResult<AuditTrailEntry>> {
    const { tenantId, page, limit, sanitize = false } = opts;
    const offset = (page - 1) * limit;

    const [logs, total] = await this.auditLogRepo.findAndCount({
      where: { tenantId },
      order: { createdAt: 'DESC' },
      skip: offset,
      take: limit,
    });

    const data: AuditTrailEntry[] = logs.map((l) => ({
      id: l.id,
      actorName: sanitize ? this.sanitizeName(l.actorName) : l.actorName,
      action: l.action,
      resource: l.resource,
      resourceId: l.resourceId,
      createdAt: l.createdAt,
      previousData: sanitize ? null : l.previousData,
      newData: sanitize ? null : l.newData,
    }));

    return { data, meta: { total, page, limit } };
  }

  /**
   * 通过 tenantSlug 找 tenantId
   */
  async getTenantIdBySlug(slug: string): Promise<string> {
    const tenant = await this.tenantRepo.findOne({ where: { slug } });
    if (!tenant) {
      throw new NotFoundException(`租户 ${slug} 不存在`);
    }
    return tenant.id;
  }

  /**
   * 检查租户是否已开启公开公示区，未开启时抛出 403
   */
  async assertPublicBulletinEnabled(slug: string): Promise<string> {
    const tenant = await this.tenantRepo.findOne({ where: { slug } });
    if (!tenant) {
      throw new NotFoundException(`租户 ${slug} 不存在`);
    }
    const settings = tenant.settings as Record<string, unknown> | null;
    if (settings?.['bulletinPublic'] === false) {
      throw new ForbiddenException('该租户未开启公开公示区');
    }
    return tenant.id;
  }

  /**
   * 名字脱敏：保留第一个字 + '**'
   * 单字名 → '张*'，多字名 → '张**'
   */
  sanitizeName(name: string): string {
    if (!name || name.length === 0) return '**';
    const first = name[0];
    if (name.length === 1) return `${first}*`;
    return `${first}**`;
  }
}
