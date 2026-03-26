import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UserService } from '../user/user.service';
import { TenantService } from '../tenant/tenant.service';
import { EmailService } from './email.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ConflictException, UnauthorizedException, BadRequestException, NotFoundException } from '@nestjs/common';
import { Role } from '../user/enums/role.enum';

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

describe('AuthService', () => {
  let service: AuthService;
  let userService: jest.Mocked<UserService>;
  let tenantService: jest.Mocked<TenantService>;
  let emailService: jest.Mocked<EmailService>;
  let jwtService: jest.Mocked<JwtService>;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UserService,
          useValue: {
            create: jest.fn(),
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
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userService = module.get(UserService);
    tenantService = module.get(TenantService);
    emailService = module.get(EmailService);
    jwtService = module.get(JwtService);
    configService = module.get(ConfigService);
  });

  describe('register', () => {
    it('应该成功注册并发送验证码', async () => {
      tenantService.findBySlug.mockResolvedValue(mockTenant as any);
      userService.create.mockResolvedValue(mockUser as any);
      userService.updateEmailVerification.mockResolvedValue(undefined);
      emailService.sendVerificationCode.mockResolvedValue(undefined);

      const result = await service.register({
        email: 'test@example.com',
        password: 'password123',
        name: '测试用户',
        tenantSlug: 'test-org',
      });

      expect(result.userId).toBe(mockUser.id);
      expect(result.message).toContain('验证码');
      expect(emailService.sendVerificationCode).toHaveBeenCalledWith(
        mockUser.email,
        expect.any(String),
        mockUser.name,
      );
    });

    it('租户不存在时应该抛出 NotFoundException', async () => {
      tenantService.findBySlug.mockResolvedValue(null);
      await expect(service.register({ email: 'a@b.com', password: 'pass123!', name: 'test', tenantSlug: 'nonexistent' }))
        .rejects.toThrow(NotFoundException);
    });

    it('禁用租户应该抛出 NotFoundException', async () => {
      tenantService.findBySlug.mockResolvedValue({ ...mockTenant, isActive: false } as any);
      await expect(service.register({ email: 'a@b.com', password: 'pass123!', name: 'test', tenantSlug: 'test-org' }))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('verifyEmail', () => {
    it('正确验证码应该返回 token', async () => {
      const expiry = new Date(Date.now() + 60000);
      userService.findByIdWithVerificationCode.mockResolvedValue({
        ...mockUser,
        isEmailVerified: false,
        emailVerificationCode: '123456',
        emailVerificationExpiry: expiry,
      } as any);
      userService.verifyEmail.mockResolvedValue(undefined);
      userService.updateRefreshToken.mockResolvedValue(undefined);

      const result = await service.verifyEmail({ userId: mockUser.id, code: '123456' });

      expect(result.accessToken).toBe('mock-token');
      expect(userService.verifyEmail).toHaveBeenCalledWith(mockUser.id);
    });

    it('错误验证码应该抛出 BadRequestException', async () => {
      const expiry = new Date(Date.now() + 60000);
      userService.findByIdWithVerificationCode.mockResolvedValue({
        ...mockUser,
        isEmailVerified: false,
        emailVerificationCode: '123456',
        emailVerificationExpiry: expiry,
      } as any);

      await expect(service.verifyEmail({ userId: mockUser.id, code: '000000' }))
        .rejects.toThrow(BadRequestException);
    });

    it('过期验证码应该抛出 BadRequestException', async () => {
      const expiry = new Date(Date.now() - 1000); // 过期
      userService.findByIdWithVerificationCode.mockResolvedValue({
        ...mockUser,
        isEmailVerified: false,
        emailVerificationCode: '123456',
        emailVerificationExpiry: expiry,
      } as any);

      await expect(service.verifyEmail({ userId: mockUser.id, code: '123456' }))
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
