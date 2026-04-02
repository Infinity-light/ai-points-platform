import {
  Injectable,
  Inject,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
  forwardRef,
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
import { FeishuClientService } from '../feishu/feishu-client.service';
import { FeishuConfigService } from '../feishu/feishu-config.service';

/** Well-known UUID for the seeded super_admin role (migration 018) */
const SUPER_ADMIN_ROLE_ID = '00000000-0000-0000-0000-000000000001';
const EMPLOYEE_ROLE_ID = '00000000-0000-0000-0000-000000000004';

const FEISHU_STATE_REDIS_PREFIX = 'feishu:state:';
const FEISHU_LINK_TOKEN_PREFIX = 'feishu:link:';
const FEISHU_STATE_TTL = 300; // 5 minutes
const FEISHU_LINK_TOKEN_TTL = 600; // 10 minutes

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
    @Inject(forwardRef(() => FeishuClientService))
    private readonly feishuClientService: FeishuClientService,
    @Inject(forwardRef(() => FeishuConfigService))
    private readonly feishuConfigService: FeishuConfigService,
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

  // ─── Feishu OAuth ─────────────────────────────────────────────────────────

  async generateFeishuState(tenantSlug: string): Promise<string> {
    const csrf = randomUUID();
    const state = await this.jwtService.signAsync(
      { tenantSlug, csrf },
      {
        secret: this.configService.get<string>('auth.jwtSecret') ?? this.configService.get<string>('JWT_SECRET'),
        expiresIn: '5m',
      },
    );
    await this.redis.set(`${FEISHU_STATE_REDIS_PREFIX}${csrf}`, tenantSlug, 'EX', FEISHU_STATE_TTL);
    return state;
  }

  async verifyFeishuState(state: string): Promise<{ tenantSlug: string; csrf: string }> {
    try {
      const payload = await this.jwtService.verifyAsync<{ tenantSlug: string; csrf: string }>(state, {
        secret: this.configService.get<string>('auth.jwtSecret') ?? this.configService.get<string>('JWT_SECRET'),
      });
      return payload;
    } catch {
      throw new UnauthorizedException('无效或过期的 state');
    }
  }

  async getFeishuAuthUrl(tenantSlug: string): Promise<string> {
    const tenant = await this.tenantService.findBySlug(tenantSlug);
    if (!tenant) throw new NotFoundException('组织不存在');

    const config = await this.feishuConfigService.getConfig(tenant.id);
    if (!config || !config.enabled) {
      throw new BadRequestException('该组织未启用飞书登录');
    }

    const state = await this.generateFeishuState(tenantSlug);
    const callbackUrl = this.configService.get<string>('feishu.callbackUrl') ?? '';

    return `https://open.feishu.cn/open-apis/authen/v1/authorize?app_id=${config.appId}&redirect_uri=${encodeURIComponent(callbackUrl)}&scope=contact:user.base:readonly&state=${encodeURIComponent(state)}`;
  }

  async handleFeishuCallback(
    tenantSlug: string,
    code: string,
  ): Promise<{
    authResponse?: AuthResponse;
    needsLinking?: boolean;
    linkToken?: string;
    feishuName?: string;
    matchedEmail?: string;
  }> {
    const tenant = await this.tenantService.findBySlug(tenantSlug);
    if (!tenant) throw new NotFoundException('组织不存在');

    const client = await this.feishuClientService.getClient(tenant.id);

    // Exchange code for user access token
    const tokenRes = await client.authen.oidcAccessToken.create({
      data: { grant_type: 'authorization_code', code },
    });

    const accessToken = (tokenRes as { data?: { access_token?: string } }).data?.access_token;
    if (!accessToken) {
      throw new BadRequestException('飞书授权码换取 token 失败');
    }

    // Get user info
    const userInfoRes = await client.authen.userInfo.get({
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const feishuUser = (userInfoRes as { data?: Record<string, unknown> }).data ?? {};
    const openId = feishuUser['open_id'] as string | undefined;
    const unionId = feishuUser['union_id'] as string | undefined;
    const feishuName = (feishuUser['name'] as string | undefined) ?? '';
    const feishuEmail = feishuUser['email'] as string | undefined;
    const avatarUrl = (feishuUser['avatar_url'] as string | undefined) ?? null;

    if (!openId) {
      throw new BadRequestException('无法获取飞书用户信息');
    }

    // 1. Try match by feishuOpenId
    const existingByOpenId = await this.userService.findByFeishuOpenId(tenant.id, openId);
    if (existingByOpenId) {
      const authResponse = await this.generateAuthResponse(existingByOpenId);
      return { authResponse };
    }

    // 2. Try match by email
    if (feishuEmail) {
      const existingByEmail = await this.userService.findByEmail(tenant.id, feishuEmail);
      if (existingByEmail) {
        // Store link info in Redis for confirmation
        const linkToken = randomUUID();
        await this.redis.set(
          `${FEISHU_LINK_TOKEN_PREFIX}${linkToken}`,
          JSON.stringify({
            tenantId: tenant.id,
            userId: existingByEmail.id,
            openId,
            unionId: unionId ?? null,
            avatarUrl,
            feishuName,
            feishuEmail,
          }),
          'EX',
          FEISHU_LINK_TOKEN_TTL,
        );
        return { needsLinking: true, linkToken, feishuName, matchedEmail: existingByEmail.email };
      }
    }

    // 3. Create new user
    const email = feishuEmail ?? `${openId}@feishu.local`;
    const newUser = await this.userService.createFromFeishu(tenant.id, {
      email,
      name: feishuName || openId,
      feishuOpenId: openId,
      feishuUnionId: unionId ?? null,
      avatarUrl,
    });

    // Assign employee role
    const existing = await this.userRoleRepo.findOne({ where: { userId: newUser.id } });
    if (!existing) {
      await this.userRoleRepo.save(
        this.userRoleRepo.create({ userId: newUser.id, roleId: EMPLOYEE_ROLE_ID }),
      );
    }

    const authResponse = await this.generateAuthResponse(newUser);
    return { authResponse };
  }

  async confirmFeishuLink(
    linkToken: string,
    action: 'link' | 'create_new',
  ): Promise<AuthResponse> {
    const raw = await this.redis.get(`${FEISHU_LINK_TOKEN_PREFIX}${linkToken}`);
    if (!raw) throw new BadRequestException('链接令牌已过期，请重新登录');

    const data: {
      tenantId: string;
      userId: string;
      openId: string;
      unionId: string | null;
      avatarUrl: string | null;
      feishuName: string;
      feishuEmail: string;
    } = JSON.parse(raw);

    await this.redis.del(`${FEISHU_LINK_TOKEN_PREFIX}${linkToken}`);

    if (action === 'link') {
      const user = await this.userService.linkFeishu(data.userId, data.openId, data.unionId, data.avatarUrl);
      return this.generateAuthResponse(user);
    } else {
      // Create new account
      const email = data.feishuEmail ?? `${data.openId}@feishu.local`;
      const newUser = await this.userService.createFromFeishu(data.tenantId, {
        email,
        name: data.feishuName || data.openId,
        feishuOpenId: data.openId,
        feishuUnionId: data.unionId,
        avatarUrl: data.avatarUrl,
      });
      await this.userRoleRepo.save(
        this.userRoleRepo.create({ userId: newUser.id, roleId: EMPLOYEE_ROLE_ID }),
      );
      return this.generateAuthResponse(newUser);
    }
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
