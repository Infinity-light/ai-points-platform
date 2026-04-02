import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UserService } from '../user/user.service';
import { TenantService } from '../tenant/tenant.service';
import { EmailService } from './email.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ConflictException, UnauthorizedException, BadRequestException, NotFoundException } from '@nestjs/common';
import { Role } from '../user/enums/role.enum';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UserRole } from '../rbac/entities/user-role.entity';

const mockUser = {
  id: 'user-uuid',
  email: 'test@example.com',
  name: '测试用户',
  tenantId: 'tenant-uuid',
  role: Role.EMPLOYEE,
  isEmailVerified: true,
  refreshToken: null,
  phone: null,
  inviteCodeUsed: null,
  emailVerificationCode: null,
  emailVerificationExpiry: null,
  passwordHash: 'hash',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockTenant = {
  id: 'tenant-uuid',
  name: '测试组织',
  slug: 'test-org',
  isActive: true,
  settings: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Mock Redis
const redisStore: Record<string, string> = {};
const mockRedis = {
  set: jest.fn(async (key: string, value: string) => { redisStore[key] = value; return 'OK'; }),
  get: jest.fn(async (key: string) => redisStore[key] ?? null),
  del: jest.fn(async (key: string) => { delete redisStore[key]; return 1; }),
};

describe('AuthService', () => {
  let service: AuthService;
  let userService: jest.Mocked<UserService>;
  let tenantService: jest.Mocked<TenantService>;
  let emailService: jest.Mocked<EmailService>;

  beforeEach(async () => {
    // Clear Redis store between tests
    Object.keys(redisStore).forEach(k => delete redisStore[k]);
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UserService,
          useValue: {
            create: jest.fn(),
            createVerified: jest.fn(),
            findByEmail: jest.fn(),
            findById: jest.fn(),
            findByIdGlobal: jest.fn(),
            findByIdWithRefreshToken: jest.fn(),
            findByIdWithVerificationCode: jest.fn(),
            updateEmailVerification: jest.fn(),
            verifyEmail: jest.fn(),
            updateRefreshToken: jest.fn(),
            validatePassword: jest.fn(),
          },
        },
        {
          provide: TenantService,
          useValue: {
            findBySlug: jest.fn(),
            findOne: jest.fn().mockResolvedValue(mockTenant),
          },
        },
        {
          provide: EmailService,
          useValue: {
            sendVerificationCode: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn().mockResolvedValue('mock-token'),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('test-secret'),
          },
        },
        {
          provide: getRepositoryToken(UserRole),
          useValue: {
            create: jest.fn().mockReturnValue({}),
            save: jest.fn(),
          },
        },
        {
          provide: 'REDIS_CLIENT',
          useValue: mockRedis,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userService = module.get(UserService);
    tenantService = module.get(TenantService);
    emailService = module.get(EmailService);
  });

  describe('register', () => {
    it('应该存入 Redis 并发送验证码，不创建用户', async () => {
      tenantService.findBySlug.mockResolvedValue(mockTenant as any);
      userService.findByEmail.mockResolvedValue(null);
      emailService.sendVerificationCode.mockResolvedValue(undefined);

      const result = await service.register({
        email: 'test@example.com',
        password: 'password123',
        name: '测试用户',
        tenantSlug: 'test-org',
      });

      expect(result.pendingId).toBeDefined();
      expect(result.message).toContain('验证码');
      expect(mockRedis.set).toHaveBeenCalled();
      expect(userService.create).not.toHaveBeenCalled();
      expect(userService.createVerified).not.toHaveBeenCalled();
      expect(emailService.sendVerificationCode).toHaveBeenCalledWith(
        'test@example.com',
        expect.any(String),
        '测试用户',
      );
    });

    it('租户不存在时应该抛出 NotFoundException', async () => {
      tenantService.findBySlug.mockResolvedValue(null);
      await expect(service.register({ email: 'a@b.com', password: 'pass123!', name: 'test', tenantSlug: 'nonexistent' }))
        .rejects.toThrow(NotFoundException);
    });

    it('邮箱已被已验证用户占用时应该抛出 ConflictException', async () => {
      tenantService.findBySlug.mockResolvedValue(mockTenant as any);
      userService.findByEmail.mockResolvedValue({ ...mockUser, isEmailVerified: true } as any);

      await expect(service.register({ email: 'test@example.com', password: 'pass123!', name: 'test', tenantSlug: 'test-org' }))
        .rejects.toThrow(ConflictException);
    });

    it('邮箱被未验证用户占用时应该允许注册', async () => {
      tenantService.findBySlug.mockResolvedValue(mockTenant as any);
      userService.findByEmail.mockResolvedValue({ ...mockUser, isEmailVerified: false } as any);
      emailService.sendVerificationCode.mockResolvedValue(undefined);

      const result = await service.register({
        email: 'test@example.com',
        password: 'password123',
        name: '测试用户',
        tenantSlug: 'test-org',
      });

      expect(result.pendingId).toBeDefined();
    });
  });

  describe('verifyEmail', () => {
    it('正确验证码应该创建用户并返回 token', async () => {
      // 先注册存入 Redis
      tenantService.findBySlug.mockResolvedValue(mockTenant as any);
      userService.findByEmail.mockResolvedValue(null);
      emailService.sendVerificationCode.mockResolvedValue(undefined);
      const reg = await service.register({
        email: 'test@example.com', password: 'password123', name: '测试用户', tenantSlug: 'test-org',
      });

      // 从 Redis 中获取验证码
      const pending = JSON.parse(redisStore[`register:${reg.pendingId}`]);

      userService.createVerified.mockResolvedValue(mockUser as any);
      userService.updateRefreshToken.mockResolvedValue(undefined);

      const result = await service.verifyEmail({ pendingId: reg.pendingId, code: pending.verificationCode });

      expect(result.accessToken).toBe('mock-token');
      expect(userService.createVerified).toHaveBeenCalled();
    });

    it('错误验证码应该抛出 BadRequestException', async () => {
      tenantService.findBySlug.mockResolvedValue(mockTenant as any);
      userService.findByEmail.mockResolvedValue(null);
      emailService.sendVerificationCode.mockResolvedValue(undefined);
      const reg = await service.register({
        email: 'test@example.com', password: 'password123', name: '测试用户', tenantSlug: 'test-org',
      });

      await expect(service.verifyEmail({ pendingId: reg.pendingId, code: '000000' }))
        .rejects.toThrow(BadRequestException);
    });

    it('不存在的 pendingId 应该抛出 BadRequestException', async () => {
      await expect(service.verifyEmail({ pendingId: 'nonexistent', code: '123456' }))
        .rejects.toThrow(BadRequestException);
    });
  });

  describe('login', () => {
    it('正确凭证应该返回 token', async () => {
      tenantService.findBySlug.mockResolvedValue(mockTenant as any);
      userService.findByEmail.mockResolvedValue(mockUser as any);
      userService.validatePassword.mockResolvedValue(true);
      userService.updateRefreshToken.mockResolvedValue(undefined);

      const result = await service.login({ email: mockUser.email, password: 'pass', tenantSlug: 'test-org' });

      expect(result.accessToken).toBe('mock-token');
      expect(result.user.email).toBe(mockUser.email);
    });

    it('错误密码应该抛出 UnauthorizedException', async () => {
      tenantService.findBySlug.mockResolvedValue(mockTenant as any);
      userService.findByEmail.mockResolvedValue(mockUser as any);
      userService.validatePassword.mockResolvedValue(false);

      await expect(service.login({ email: mockUser.email, password: 'wrong', tenantSlug: 'test-org' }))
        .rejects.toThrow(UnauthorizedException);
    });

    it('未验证邮箱应该抛出 UnauthorizedException', async () => {
      tenantService.findBySlug.mockResolvedValue(mockTenant as any);
      userService.findByEmail.mockResolvedValue({ ...mockUser, isEmailVerified: false } as any);
      userService.validatePassword.mockResolvedValue(true);

      await expect(service.login({ email: mockUser.email, password: 'pass', tenantSlug: 'test-org' }))
        .rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('应该清除 refresh token', async () => {
      userService.updateRefreshToken.mockResolvedValue(undefined);
      await service.logout(mockUser.id);
      expect(userService.updateRefreshToken).toHaveBeenCalledWith(mockUser.id, null);
    });
  });
});
