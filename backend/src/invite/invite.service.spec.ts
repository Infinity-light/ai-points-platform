import { Test, TestingModule } from '@nestjs/testing';
import { InviteService } from './invite.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Invite } from './entities/invite.entity';
import { InviteUsage } from './entities/invite-usage.entity';
import { BadRequestException, NotFoundException } from '@nestjs/common';

const mockInvite: Invite = {
  id: 'invite-uuid',
  tenantId: 'tenant-uuid',
  code: 'ABCD1234',
  maxUses: 5,
  usedCount: 0,
  expiresAt: null,
  isActive: true,
  note: null,
  createdBy: 'user-uuid',
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('InviteService', () => {
  let service: InviteService;
  let inviteRepo: {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
    find: jest.Mock;
    increment: jest.Mock;
  };
  let usageRepo: {
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
  };

  beforeEach(async () => {
    inviteRepo = {
      create: jest.fn().mockImplementation((data) => data),
      save: jest.fn().mockImplementation((invite) => Promise.resolve({ ...mockInvite, ...invite })),
      findOne: jest.fn(),
      find: jest.fn(),
      increment: jest.fn().mockResolvedValue(undefined),
    };

    usageRepo = {
      create: jest.fn().mockImplementation((data) => data),
      save: jest.fn().mockResolvedValue({}),
      find: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InviteService,
        { provide: getRepositoryToken(Invite), useValue: inviteRepo },
        { provide: getRepositoryToken(InviteUsage), useValue: usageRepo },
      ],
    }).compile();

    service = module.get<InviteService>(InviteService);
  });

  describe('create', () => {
    it('应该创建邀请码', async () => {
      inviteRepo.findOne.mockResolvedValue(null); // 无重复码
      const result = await service.create('tenant-uuid', 'user-uuid', { maxUses: 3, note: '测试' });
      expect(result.code).toBeDefined();
      expect(result.code.length).toBe(8);
    });

    it('应该使用默认 maxUses=1', async () => {
      inviteRepo.findOne.mockResolvedValue(null);
      inviteRepo.save.mockImplementation((invite: any) => Promise.resolve(invite));
      const result = await service.create('tenant-uuid', 'user-uuid', {});
      expect(result.maxUses).toBe(1);
    });
  });

  describe('validateCode', () => {
    it('有效码应该通过验证', async () => {
      inviteRepo.findOne.mockResolvedValue(mockInvite);
      const result = await service.validateCode('tenant-uuid', 'ABCD1234');
      expect(result.code).toBe('ABCD1234');
    });

    it('不存在的码应该抛出 BadRequestException', async () => {
      inviteRepo.findOne.mockResolvedValue(null);
      await expect(service.validateCode('tenant-uuid', 'INVALID')).rejects.toThrow(BadRequestException);
    });

    it('已停用的码应该抛出 BadRequestException', async () => {
      inviteRepo.findOne.mockResolvedValue({ ...mockInvite, isActive: false });
      await expect(service.validateCode('tenant-uuid', 'ABCD1234')).rejects.toThrow(BadRequestException);
    });

    it('已过期的码应该抛出 BadRequestException', async () => {
      inviteRepo.findOne.mockResolvedValue({
        ...mockInvite,
        expiresAt: new Date(Date.now() - 1000), // 已过期
      });
      await expect(service.validateCode('tenant-uuid', 'ABCD1234')).rejects.toThrow(BadRequestException);
    });

    it('达到使用上限的码应该抛出 BadRequestException', async () => {
      inviteRepo.findOne.mockResolvedValue({ ...mockInvite, maxUses: 1, usedCount: 1 });
      await expect(service.validateCode('tenant-uuid', 'ABCD1234')).rejects.toThrow(BadRequestException);
    });

    it('未过期的码应该通过验证', async () => {
      inviteRepo.findOne.mockResolvedValue({
        ...mockInvite,
        expiresAt: new Date(Date.now() + 60000), // 未过期
      });
      const result = await service.validateCode('tenant-uuid', 'ABCD1234');
      expect(result).toBeDefined();
    });
  });

  describe('recordUsage', () => {
    it('应该增加 usedCount 并记录使用历史', async () => {
      await service.recordUsage('invite-uuid', 'tenant-uuid', 'user-uuid');
      expect(inviteRepo.increment).toHaveBeenCalledWith({ id: 'invite-uuid' }, 'usedCount', 1);
      expect(usageRepo.save).toHaveBeenCalled();
    });
  });

  describe('deactivate', () => {
    it('应该停用邀请码', async () => {
      inviteRepo.findOne.mockResolvedValue({ ...mockInvite });
      inviteRepo.save.mockImplementation((invite: any) => Promise.resolve(invite));
      const result = await service.deactivate('invite-uuid', 'tenant-uuid');
      expect(result.isActive).toBe(false);
    });

    it('不存在的邀请码应该抛出 NotFoundException', async () => {
      inviteRepo.findOne.mockResolvedValue(null);
      await expect(service.deactivate('nonexistent', 'tenant-uuid')).rejects.toThrow(NotFoundException);
    });
  });

  describe('isCodeValid', () => {
    it('有效码返回 { valid: true }', async () => {
      inviteRepo.findOne.mockResolvedValue({ ...mockInvite });
      const result = await service.isCodeValid('tenant-uuid', 'ABCD1234');
      expect(result.valid).toBe(true);
    });

    it('无效码返回 { valid: false, message: ... }', async () => {
      inviteRepo.findOne.mockResolvedValue(null);
      const result = await service.isCodeValid('tenant-uuid', 'INVALID');
      expect(result.valid).toBe(false);
      expect(result.message).toBeDefined();
    });
  });
});
