import {
  Injectable,
  Inject,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import Redis from 'ioredis';
import { UserService } from '../user/user.service';
import { TenantService } from '../tenant/tenant.service';
import { EmailService } from './email.service';
import { RegisterDto } from './dto/register.dto';
import { RegisterOrgDto } from './dto/register-org.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { User } from '../user/entities/user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRole } from '../rbac/entities/user-role.entity';

/** Well-known UUID for the seeded super_admin role (migration 018) */
const SUPER_ADMIN_ROLE_ID = '00000000-0000-0000-0000-000000000001';

const SALT_ROUNDS = 12;
const REDIS_PREFIX = 'register:';
const REDIS_TTL = 900; // 15 minutes

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse extends TokenPair {
  user: {
    id: string;
    email: string;
    name: string;
    tenantId: string;
    tenantName: string;
    isEmailVerified: boolean;
  };
}

interface PendingRegistration {
  email: string;
  passwordHash: string;
  name: string;
  phone?: string;
  tenantId?: string;
  inviteCode?: string;
  verificationCode: string;
  mode: 'join' | 'create';
  orgName?: string;
  orgSlug?: string;
}

function generateCode(length = 6): string {
  return Array.from({ length }, () => Math.floor(Math.random() * 10)).join('');
}

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly tenantService: TenantService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
    @InjectRepository(UserRole)
    private readonly userRoleRepo: Repository<UserRole>,
    @Inject('REDIS_CLIENT')
    private readonly redis: Redis,
  ) {}

  async register(dto: RegisterDto): Promise<{ pendingId: string; message: string }> {
    // 1. 验证租户
    const tenant = await this.tenantService.findBySlug(dto.tenantSlug);
    if (!tenant || !tenant.isActive) {
      throw new NotFoundException('组织不存在或已停用');
    }

    // 2. 检查邮箱是否已被已验证用户占用
    const existingUser = await this.userService.findByEmail(tenant.id, dto.email);
    if (existingUser && existingUser.isEmailVerified) {
      throw new ConflictException('该邮箱在此组织中已被注册');
    }

    // 3. Hash 密码，生成 pendingId 和验证码
    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    const pendingId = randomUUID();
    const code = generateCode(6);

    // 4. 存入 Redis
    const pending: PendingRegistration = {
      email: dto.email,
      passwordHash,
      name: dto.name,
      phone: dto.phone,
      tenantId: tenant.id,
      inviteCode: dto.inviteCode,
      verificationCode: code,
      mode: 'join',
    };
    await this.redis.set(
      `${REDIS_PREFIX}${pendingId}`,
      JSON.stringify(pending),
      'EX',
      REDIS_TTL,
    );

    // 5. 发送验证码邮件
    await this.emailService.sendVerificationCode(dto.email, code, dto.name);

    return { pendingId, message: '注册成功，请检查邮箱并输入验证码' };
  }

  async registerWithOrg(dto: RegisterOrgDto): Promise<{ pendingId: string; message: string }> {
    // 1. 校验 slug 可用性
    const existingTenant = await this.tenantService.findBySlug(dto.orgSlug);
    if (existingTenant) {
      throw new ConflictException('该组织标识已被占用');
    }

    // 2. Hash 密码，生成 pendingId 和验证码
    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    const pendingId = randomUUID();
    const code = generateCode(6);

    // 3. 存入 Redis
    const pending: PendingRegistration = {
      email: dto.email,
      passwordHash,
      name: dto.name,
      phone: dto.phone,
      verificationCode: code,
      mode: 'create',
      orgName: dto.orgName,
      orgSlug: dto.orgSlug,
    };
    await this.redis.set(
      `${REDIS_PREFIX}${pendingId}`,
      JSON.stringify(pending),
      'EX',
      REDIS_TTL,
    );

    // 4. 发送验证码
    await this.emailService.sendVerificationCode(dto.email, code, dto.name);

    return { pendingId, message: '组织创建成功，请检查邮箱并输入验证码' };
  }

  async verifyEmail(dto: VerifyEmailDto): Promise<AuthResponse> {
    // 1. 从 Redis 读取待注册数据
    const raw = await this.redis.get(`${REDIS_PREFIX}${dto.pendingId}`);
    if (!raw) {
      throw new BadRequestException('注册已过期，请重新注册');
    }

    const pending: PendingRegistration = JSON.parse(raw);

    // 2. 比对验证码
    if (pending.verificationCode !== dto.code) {
      throw new BadRequestException('验证码错误');
    }

    // 3. 根据 mode 创建用户（和租户）
    let user: User;

    if (pending.mode === 'create') {
      // 创建组织模式：先建租户，再建用户，分配 super_admin
      let tenant;
      try {
        tenant = await this.tenantService.create({
          name: pending.orgName!,
          slug: pending.orgSlug!,
        });
      } catch (err) {
        if ((err as { status?: number })?.status === 409) {
          throw new ConflictException('该组织标识已被占用，请重新注册');
        }
        throw err;
      }

      user = await this.userService.createVerified({
        tenantId: tenant.id,
        email: pending.email,
        passwordHash: pending.passwordHash,
        name: pending.name,
        phone: pending.phone,
      });

      // 分配 super_admin 角色
      await this.userRoleRepo.save(
        this.userRoleRepo.create({ userId: user.id, roleId: SUPER_ADMIN_ROLE_ID }),
      );
    } else {
      // 加入组织模式
      user = await this.userService.createVerified({
        tenantId: pending.tenantId!,
        email: pending.email,
        passwordHash: pending.passwordHash,
        name: pending.name,
        phone: pending.phone,
        inviteCode: pending.inviteCode,
      });
    }

    // 4. 删除 Redis key
    await this.redis.del(`${REDIS_PREFIX}${dto.pendingId}`);

    // 5. 返回登录信息
    return this.generateAuthResponse({ ...user, isEmailVerified: true });
  }

  async resendVerification(pendingId: string): Promise<{ message: string }> {
    const key = `${REDIS_PREFIX}${pendingId}`;
    const raw = await this.redis.get(key);
    if (!raw) {
      throw new BadRequestException('注册已过期，请重新注册');
    }

    const pending: PendingRegistration = JSON.parse(raw);

    // 生成新验证码，重置 TTL
    const code = generateCode(6);
    pending.verificationCode = code;
    await this.redis.set(key, JSON.stringify(pending), 'EX', REDIS_TTL);

    // 重新发送邮件
    await this.emailService.sendVerificationCode(pending.email, code, pending.name);

    return { message: '验证码已重新发送' };
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const tenant = await this.tenantService.findBySlug(dto.tenantSlug);
    if (!tenant || !tenant.isActive) throw new UnauthorizedException('组织不存在');

    const user = await this.userService.findByEmail(tenant.id, dto.email);
    if (!user) throw new UnauthorizedException('邮箱或密码错误');

    const isPasswordValid = await this.userService.validatePassword(user, dto.password);
    if (!isPasswordValid) throw new UnauthorizedException('邮箱或密码错误');

    if (!user.isEmailVerified) {
      throw new UnauthorizedException('请先完成邮箱验证');
    }

    return this.generateAuthResponse(user);
  }

  async refreshTokens(userId: string, tenantId: string, rawRefreshToken: string): Promise<TokenPair> {
    const user = await this.userService.findByIdWithRefreshToken(userId);
    if (!user || !user.refreshToken) throw new UnauthorizedException('无效的刷新令牌');

    const isValid = await bcrypt.compare(rawRefreshToken, user.refreshToken);
    if (!isValid) throw new UnauthorizedException('无效的刷新令牌');

    const tokens = await this.generateTokens(user);
    await this.userService.updateRefreshToken(user.id, tokens.refreshToken);
    return tokens;
  }

  async logout(userId: string): Promise<void> {
    await this.userService.updateRefreshToken(userId, null);
  }

  private async generateTokens(user: User): Promise<TokenPair> {
    const payload = {
      sub: user.id,
      email: user.email,
      tenantId: user.tenantId,
    };

    const jwtExpiresIn = (this.configService.get<string>('auth.jwtExpiresIn') ?? '15m') as `${number}${'s' | 'm' | 'h' | 'd' | 'w' | 'y'}`;
    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('auth.jwtSecret') ?? this.configService.get<string>('JWT_SECRET'),
      expiresIn: jwtExpiresIn,
    });

    const jwtRefreshExpiresIn = (this.configService.get<string>('auth.jwtRefreshExpiresIn') ?? '7d') as `${number}${'s' | 'm' | 'h' | 'd' | 'w' | 'y'}`;
    const refreshToken = await this.jwtService.signAsync(
      { sub: user.id, tenantId: user.tenantId },
      {
        secret: this.configService.get<string>('auth.jwtRefreshSecret') ?? this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: jwtRefreshExpiresIn,
      },
    );

    return { accessToken, refreshToken };
  }

  private async generateAuthResponse(user: User): Promise<AuthResponse> {
    const tokens = await this.generateTokens(user);
    await this.userService.updateRefreshToken(user.id, tokens.refreshToken);

    const tenant = await this.tenantService.findOne(user.tenantId);

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        tenantId: user.tenantId,
        tenantName: tenant.name,
        isEmailVerified: user.isEmailVerified,
      },
    };
  }
}
