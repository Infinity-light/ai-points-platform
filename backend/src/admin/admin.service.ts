import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../user/entities/user.entity';
import { PointRecord } from '../points/entities/point-record.entity';
import { Invite } from '../invite/entities/invite.entity';
import { UserRole } from '../rbac/entities/user-role.entity';
import { ProjectMember } from '../project/entities/project-member.entity';
import { Project } from '../project/entities/project.entity';
import { CreateInviteDto } from '../invite/dto/create-invite.dto';

function generateInviteCode(length = 8): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(
    { length },
    () => chars[Math.floor(Math.random() * chars.length)],
  ).join('');
}

export interface TenantStats {
  totalUsers: number;
  totalPointsAwarded: number;
  activeInviteCodes: number;
}

export interface UserProjectInfo {
  projectId: string;
  projectName: string;
  projectStatus: string;
  projectRoleId: string;
  projectRoleName: string | null;
  joinedAt: Date;
}

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(PointRecord)
    private readonly pointRepo: Repository<PointRecord>,
    @InjectRepository(Invite)
    private readonly inviteRepo: Repository<Invite>,
    @InjectRepository(UserRole)
    private readonly userRoleRepo: Repository<UserRole>,
    @InjectRepository(ProjectMember)
    private readonly projectMemberRepo: Repository<ProjectMember>,
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
  ) {}

  async listUsers(tenantId: string) {
    const users = await this.userRepo.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });
    // Attach tenant role info
    const userIds = users.map((u) => u.id);
    const userRoles = userIds.length > 0
      ? await this.userRoleRepo.find({
          where: userIds.map((uid) => ({ userId: uid })),
          relations: ['role'],
        })
      : [];
    const roleMap = new Map(userRoles.map((ur) => [ur.userId, ur]));
    return users.map((u) => ({
      ...u,
      tenantRoleId: roleMap.get(u.id)?.roleId ?? null,
      tenantRoleName: roleMap.get(u.id)?.role?.name ?? null,
    }));
  }

  async updateUserRole(userId: string, tenantId: string, roleId: string): Promise<UserRole> {
    const user = await this.userRepo.findOne({ where: { id: userId, tenantId } });
    if (!user) {
      throw new NotFoundException(`用户 ${userId} 不存在`);
    }

    const existing = await this.userRoleRepo.findOne({ where: { userId } });
    if (existing) {
      existing.roleId = roleId;
      return this.userRoleRepo.save(existing);
    }

    const userRole = this.userRoleRepo.create({ userId, roleId });
    return this.userRoleRepo.save(userRole);
  }

  async getTenantStats(tenantId: string): Promise<TenantStats> {
    const totalUsers = await this.userRepo.count({ where: { tenantId } });

    const pointsResult = await this.pointRepo
      .createQueryBuilder('pr')
      .select('SUM(pr.originalPoints)', 'total')
      .where('pr.tenantId = :tenantId', { tenantId })
      .getRawOne<{ total: string | null }>();

    const totalPointsAwarded = Number(pointsResult?.total ?? 0);

    const activeInviteCodes = await this.inviteRepo.count({
      where: { tenantId, isActive: true },
    });

    return {
      totalUsers,
      totalPointsAwarded,
      activeInviteCodes,
    };
  }

  async createInviteCode(
    tenantId: string,
    createdBy: string,
    dto: CreateInviteDto,
  ): Promise<Invite> {
    let code: string;
    let attempts = 0;
    do {
      code = generateInviteCode(8);
      const existing = await this.inviteRepo.findOne({ where: { tenantId, code } });
      if (!existing) break;
      attempts++;
    } while (attempts < 10);

    const invite = this.inviteRepo.create({
      tenantId,
      code: code!,
      maxUses: dto.maxUses ?? 10,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      note: dto.note ?? null,
      createdBy,
      isActive: true,
    });

    return this.inviteRepo.save(invite);
  }

  async listInviteCodes(tenantId: string): Promise<Invite[]> {
    return this.inviteRepo.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });
  }

  async toggleInviteCode(codeId: string, tenantId: string, isActive: boolean): Promise<Invite> {
    const invite = await this.inviteRepo.findOne({ where: { id: codeId, tenantId } });
    if (!invite) {
      throw new NotFoundException(`邀请码 ${codeId} 不存在`);
    }
    invite.isActive = isActive;
    return this.inviteRepo.save(invite);
  }

  async getUserProjects(userId: string, tenantId: string): Promise<UserProjectInfo[]> {
    const user = await this.userRepo.findOne({ where: { id: userId, tenantId } });
    if (!user) {
      throw new NotFoundException(`用户 ${userId} 不存在`);
    }

    const members = await this.projectMemberRepo.find({
      where: { userId, tenantId },
      relations: ['projectRole'],
    });

    const projectIds = members.map((m) => m.projectId);
    if (projectIds.length === 0) {
      return [];
    }

    const projects = await this.projectRepo
      .createQueryBuilder('p')
      .where('p.id IN (:...ids)', { ids: projectIds })
      .getMany();

    const projectMap = new Map(projects.map((p) => [p.id, p]));

    return members.map((m) => ({
      projectId: m.projectId,
      projectName: projectMap.get(m.projectId)?.name ?? '未知项目',
      projectStatus: projectMap.get(m.projectId)?.status ?? 'unknown',
      projectRoleId: m.projectRoleId,
      projectRoleName: m.projectRole?.name ?? null,
      joinedAt: m.joinedAt,
    }));
  }
}
