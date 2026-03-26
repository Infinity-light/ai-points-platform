import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { UserService } from '../user/user.service';
import { TenantService } from '../tenant/tenant.service';
import { EmailService } from './email.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { User } from '../user/entities/user.entity';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse extends TokenPair {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    tenantId: string;
    isEmailVerified: boolean;
  };
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
  ) {}

  async register(dto: RegisterDto): Promise<{ userId: string; message: string }> {
    // 1. 验证租户
    const tenant = await this.tenantService.findBySlug(dto.tenantSlug);
    if (!tenant || !tenant.isActive) {
      throw new NotFoundException('组织不存在或已停用');
    }

    // 2. 如果有邀请码，校验（这里只做基本存储，Invite模块在T09中会做完整校验）
    // 邀请码校验逻辑由 InviteService 处理，Auth 仅传递给 User

    // 3. 创建用户
    let user: User;
    try {
      user = await this.userService.create({
        tenantId: tenant.id,
        email: dto.email,
        password: dto.password,
        name: dto.name,
        phone: dto.phone,
        inviteCode: dto.inviteCode,
      });
    } catch (err) {
      if ((err as { status?: number })?.status === 409) {
        throw new ConflictException('该邮箱在此组织中已被注册');
      }
      throw err;
    }

    // 4. 生成验证码并发送邮件
    const code = generateCode(6);
    const expiry = new Date(Date.now() + 15 * 60 * 1000); // 15分钟
    await this.userService.updateEmailVerification(user.id, code, expiry);
    await this.emailService.sendVerificationCode(user.email, code, user.name);

    return { userId: user.id, message: '注册成功，请检查邮箱并输入验证码' };
  }

  async verifyEmail(dto: VerifyEmailDto): Promise<AuthResponse> {
    // 获取含验证码的用户（需要特殊查询）
    const user = await this.userService.findByIdWithVerificationCode(dto.userId);
    if (!user) throw new NotFoundException('用户不存在');
    if (user.isEmailVerified) throw new BadRequestException('邮箱已验证');
    if (!user.emailVerificationCode || !user.emailVerificationExpiry) {
      throw new BadRequestException('验证码不存在，请重新发送');
    }
    if (new Date() > user.emailVerificationExpiry) {
      throw new BadRequestException('验证码已过期，请重新发送');
    }
    if (user.emailVerificationCode !== dto.code) {
      throw new BadRequestException('验证码错误');
    }

    await this.userService.verifyEmail(user.id);

    // 验证成功后直接登录
    return this.generateAuthResponse({ ...user, isEmailVerified: true });
  }

  async resendVerification(userId: string): Promise<{ message: string }> {
    const user = await this.userService.findByIdGlobal(userId);
    if (!user) throw new NotFoundException('用户不存在');
    if (user.isEmailVerified) throw new BadRequestException('邮箱已验证');

    const code = generateCode(6);
    const expiry = new Date(Date.now() + 15 * 60 * 1000);
    await this.userService.updateEmailVerification(user.id, code, expiry);
    await this.emailService.sendVerificationCode(user.email, code, user.name);

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
      role: user.role,
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

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId,
        isEmailVerified: user.isEmailVerified,
      },
    };
  }
}
