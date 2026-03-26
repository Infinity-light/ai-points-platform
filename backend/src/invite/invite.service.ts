import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invite } from './entities/invite.entity';
import { InviteUsage } from './entities/invite-usage.entity';
import { CreateInviteDto } from './dto/create-invite.dto';

function generateInviteCode(length = 8): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 去掉易混淆字符
  return Array.from(
    { length },
    () => chars[Math.floor(Math.random() * chars.length)],
  ).join('');
}

@Injectable()
export class InviteService {
  constructor(
    @InjectRepository(Invite)
    private readonly inviteRepository: Repository<Invite>,
    @InjectRepository(InviteUsage)
    private readonly inviteUsageRepository: Repository<InviteUsage>,
  ) {}

  async create(tenantId: string, createdBy: string, dto: CreateInviteDto): Promise<Invite> {
    let code: string;
    let attempts = 0;
    // 生成唯一码（重试避免极小概率碰撞）
    do {
      code = generateInviteCode(8);
      const existing = await this.inviteRepository.findOne({ where: { tenantId, code } });
      if (!existing) break;
      attempts++;
    } while (attempts < 10);

    const invite = this.inviteRepository.create({
      tenantId,
      code,
      maxUses: dto.maxUses ?? 1,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      note: dto.note ?? null,
      createdBy,
      isActive: true,
    });

    return this.inviteRepository.save(invite);
  }

  async findAll(tenantId: string): Promise<Invite[]> {
    return this.inviteRepository.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, tenantId: string): Promise<Invite> {
    const invite = await this.inviteRepository.findOne({ where: { id, tenantId } });
    if (!invite) throw new NotFoundException(`邀请码 ${id} 不存在`);
    return invite;
  }

  async deactivate(id: string, tenantId: string): Promise<Invite> {
    const invite = await this.findOne(id, tenantId);
    invite.isActive = false;
    return this.inviteRepository.save(invite);
  }

  /**
   * 验证邀请码是否有效（注册时调用）
   * 返回 invite 对象表示有效，抛出异常表示无效
   */
  async validateCode(tenantId: string, code: string): Promise<Invite> {
    const invite = await this.inviteRepository.findOne({ where: { tenantId, code } });

    if (!invite) throw new BadRequestException('邀请码无效');
    if (!invite.isActive) throw new BadRequestException('邀请码已停用');
    if (invite.expiresAt && new Date() > invite.expiresAt) {
      throw new BadRequestException('邀请码已过期');
    }
    if (invite.usedCount >= invite.maxUses) {
      throw new BadRequestException('邀请码已达到使用上限');
    }

    return invite;
  }

  /**
   * 记录邀请码使用（注册成功后调用）
   */
  async recordUsage(inviteId: string, tenantId: string, userId: string): Promise<void> {
    await this.inviteRepository.increment({ id: inviteId }, 'usedCount', 1);
    await this.inviteUsageRepository.save(
      this.inviteUsageRepository.create({ inviteId, tenantId, usedBy: userId }),
    );
  }

  async getUsageHistory(inviteId: string, tenantId: string): Promise<InviteUsage[]> {
    // 先验证 invite 属于该 tenant
    await this.findOne(inviteId, tenantId);
    return this.inviteUsageRepository.find({
      where: { inviteId, tenantId },
      order: { usedAt: 'DESC' },
    });
  }

  /**
   * 检查邀请码是否有效（不记录使用，仅返回布尔值，用于注册表单校验）
   */
  async isCodeValid(tenantId: string, code: string): Promise<{ valid: boolean; message?: string }> {
    try {
      await this.validateCode(tenantId, code);
      return { valid: true };
    } catch (err) {
      return { valid: false, message: (err as Error).message };
    }
  }
}
