import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../user/entities/user.entity';
import { PointRecord } from '../points/entities/point-record.entity';
import { Invite } from '../invite/entities/invite.entity';
import { Role } from '../user/enums/role.enum';

export interface TenantStats {
  totalUsers: number;
  usersByRole: Record<string, number>;
  totalPointsAwarded: number;
  activeInviteCodes: number;
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
  ) {}

  async listUsers(tenantId: string): Promise<User[]> {
    return this.userRepo.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });
  }

  async updateUserRole(userId: string, tenantId: string, role: Role): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id: userId, tenantId } });
    if (!user) {
      throw new NotFoundException(`用户 ${userId} 不存在`);
    }
    user.role = role;
    return this.userRepo.save(user);
  }

  async getTenantStats(tenantId: string): Promise<TenantStats> {
    const users = await this.userRepo.find({ where: { tenantId } });

    const usersByRole: Record<string, number> = {};
    for (const user of users) {
      usersByRole[user.role] = (usersByRole[user.role] ?? 0) + 1;
    }

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
      totalUsers: users.length,
      usersByRole,
      totalPointsAwarded,
      activeInviteCodes,
    };
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
}
