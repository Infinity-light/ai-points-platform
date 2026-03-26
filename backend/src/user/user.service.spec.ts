import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { UserService } from './user.service';
import { User } from './entities/user.entity';
import { Role } from './enums/role.enum';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
  compare: jest.fn().mockResolvedValue(true),
}));

const mockUser = (): User => ({
  id: 'user-uuid-1',
  tenantId: 'tenant-uuid-1',
  email: 'test@example.com',
  passwordHash: 'hashed-password',
  name: 'Test User',
  phone: null,
  role: Role.EMPLOYEE,
  isEmailVerified: false,
  emailVerificationCode: null,
  emailVerificationExpiry: null,
  refreshToken: null,
  inviteCodeUsed: null,
  createdAt: new Date(),
  updatedAt: new Date(),
});

describe('UserService', () => {
  let service: UserService;
  let repoMock: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
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
    it('should hash password and create user', async () => {
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
          role: Role.EMPLOYEE,
        }),
      );
    });

    it('should throw ConflictException if email already exists in tenant', async () => {
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
    it('should return user by id and tenantId', async () => {
      const user = mockUser();
      repoMock.findOne.mockResolvedValue(user);

      const result = await service.findById('user-uuid-1', 'tenant-uuid-1');
      expect(result).toEqual(user);
    });

    it('should throw NotFoundException if user not found', async () => {
      repoMock.findOne.mockResolvedValue(null);
      await expect(service.findById('bad-id', 'tenant-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('validatePassword', () => {
    it('should return true for correct password', async () => {
      const user = mockUser();
      const qb = createQBMock(user);
      repoMock.createQueryBuilder.mockReturnValue(qb);

      const result = await service.validatePassword(user, 'correct-password');
      expect(result).toBe(true);
    });

    it('should return false if user has no passwordHash', async () => {
      const qb = createQBMock(null);
      repoMock.createQueryBuilder.mockReturnValue(qb);

      const result = await service.validatePassword(mockUser(), 'any-password');
      expect(result).toBe(false);
    });
  });

  describe('roles guard', () => {
    it('Role enum should have all required values', () => {
      expect(Role.SUPER_ADMIN).toBe('super_admin');
      expect(Role.HR_ADMIN).toBe('hr_admin');
      expect(Role.PROJECT_LEAD).toBe('project_lead');
      expect(Role.EMPLOYEE).toBe('employee');
    });
  });
});
