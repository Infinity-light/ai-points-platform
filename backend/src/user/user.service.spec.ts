import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { UserService } from './user.service';
import { User } from './entities/user.entity';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
  compare: jest.fn().mockResolvedValue(true),
}));

const mockUser = (): User =>
  ({
    id: 'user-uuid-1',
    tenantId: 'tenant-uuid-1',
    email: 'test@example.com',
    passwordHash: 'hashed-password',
    name: 'Test User',
    phone: null,
    isEmailVerified: false,
    emailVerificationCode: null,
    emailVerificationExpiry: null,
    refreshToken: null,
    inviteCodeUsed: null,
    userRole: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }) as User;

describe('UserService', () => {
  let service: UserService;
  let repoMock: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    count: jest.Mock;
    update: jest.Mock;
    createQueryBuilder: jest.Mock;
  };

  const createQBMock = (returnValue: User | null) => ({
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(returnValue),
  });

  beforeEach(async () => {
    repoMock = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      count: jest.fn().mockResolvedValue(1),
      update: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: getRepositoryToken(User), useValue: repoMock },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  describe('create', () => {
    it('应该对密码进行哈希并创建用户', async () => {
      const dto = {
        tenantId: 'tenant-uuid-1',
        email: 'new@example.com',
        password: 'password123',
        name: 'New User',
      };
      const user = mockUser();

      repoMock.findOne.mockResolvedValue(null);
      repoMock.create.mockReturnValue(user);
      repoMock.save.mockResolvedValue(user);

      await service.create(dto);

      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 12);
      expect(repoMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'new@example.com',
          passwordHash: 'hashed-password',
        }),
      );
    });

    it('应该在邮箱已存在于租户时抛出 ConflictException', async () => {
      repoMock.findOne.mockResolvedValue(mockUser());

      await expect(
        service.create({
          tenantId: 'tenant-uuid-1',
          email: 'test@example.com',
          password: 'password123',
          name: 'Test',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findById', () => {
    it('应该按 id 和 tenantId 返回用户', async () => {
      const user = mockUser();
      repoMock.findOne.mockResolvedValue(user);

      const result = await service.findById('user-uuid-1', 'tenant-uuid-1');
      expect(result).toEqual(user);
    });

    it('应该在用户不存在时抛出 NotFoundException', async () => {
      repoMock.findOne.mockResolvedValue(null);
      await expect(service.findById('bad-id', 'tenant-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('validatePassword', () => {
    it('应该对正确密码返回 true', async () => {
      const user = mockUser();
      const qb = createQBMock(user);
      repoMock.createQueryBuilder.mockReturnValue(qb);

      const result = await service.validatePassword(user, 'correct-password');
      expect(result).toBe(true);
    });

    it('应该在用户无 passwordHash 时返回 false', async () => {
      const qb = createQBMock(null);
      repoMock.createQueryBuilder.mockReturnValue(qb);

      const result = await service.validatePassword(mockUser(), 'any-password');
      expect(result).toBe(false);
    });
  });
});
