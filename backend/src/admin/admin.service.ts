import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../user/entities/user.entity';
import { PointRecord } from '../points/entities/point-record.entity';
import { UserRole } from '../rbac/entities/user-role.entity';
import { ProjectMember } from '../project/entities/project-member.entity';
import { Project } from '../project/entities/project.entity';

export interface TenantStats {
  totalUsers: number;
  totalPointsAwarded: number;
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

    return {
      totalUsers,
      totalPointsAwarded,
    };
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
