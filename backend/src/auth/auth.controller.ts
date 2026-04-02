import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { RegisterOrgDto } from './dto/register-org.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtRefreshPayload } from './strategies/jwt-refresh.strategy';
import { Public } from './decorators/public.decorator';
import { FeishuConfigService } from '../feishu/feishu-config.service';
import { TenantService } from '../tenant/tenant.service';

interface RequestWithUser extends Request {
  user: JwtRefreshPayload & { sub: string; tenantId: string };
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly feishuConfigService: FeishuConfigService,
    private readonly tenantService: TenantService,
  ) {}

  @Public()
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Post('register-org')
  async registerOrg(@Body() dto: RegisterOrgDto) {
    return this.authService.registerWithOrg(dto);
  }

  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto);
  }

  @Public()
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  async resendVerification(@Body() dto: ResendVerificationDto) {
    return this.authService.resendVerification(dto.pendingId);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @UseGuards(JwtRefreshGuard)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Request() req: RequestWithUser) {
    return this.authService.refreshTokens(req.user.sub, req.user.tenantId, req.user.refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Request() req: RequestWithUser) {
    await this.authService.logout(req.user.sub);
    return { message: '已退出登录' };
  }

  // ─── Feishu OAuth ───────────────────────────────────────────────────────────

  @Public()
  @Get('feishu/check')
  async checkFeishu(@Query('tenantSlug') tenantSlug: string) {
    if (!tenantSlug) return { enabled: false };
    const tenant = await this.tenantService.findBySlug(tenantSlug);
    if (!tenant) return { enabled: false };
    const config = await this.feishuConfigService.getConfig(tenant.id);
    return { enabled: config?.enabled ?? false };
  }

  @Public()
  @Get('feishu')
  async startFeishuOAuth(
    @Query('tenantSlug') tenantSlug: string,
    @Res() res: Response,
  ) {
    const authUrl = await this.authService.getFeishuAuthUrl(tenantSlug);
    res.redirect(authUrl);
  }

  @Public()
  @Get('feishu/callback')
  async feishuCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    const { tenantSlug } = await this.authService.verifyFeishuState(state);

    const result = await this.authService.handleFeishuCallback(tenantSlug, code);

    if (result.needsLinking && result.linkToken) {
      // Redirect to bind confirm page with link token
      const redirectUrl = `/auth/feishu/bindConfirm?token=${encodeURIComponent(result.linkToken)}&name=${encodeURIComponent(result.feishuName ?? '')}&email=${encodeURIComponent(result.matchedEmail ?? '')}`;
      res.redirect(redirectUrl);
    } else if (result.authResponse) {
      // Redirect to dashboard with tokens
      const { accessToken, refreshToken } = result.authResponse;
      const redirectUrl = `/dashboard?accessToken=${encodeURIComponent(accessToken)}&refreshToken=${encodeURIComponent(refreshToken)}`;
      res.redirect(redirectUrl);
    } else {
      res.redirect('/login?error=feishu_failed');
    }
  }

  @Public()
  @Post('feishu/link-confirm')
  @HttpCode(HttpStatus.OK)
  async feishuLinkConfirm(
    @Body() body: { token: string; action: 'link' | 'create_new' },
  ) {
    return this.authService.confirmFeishuLink(body.token, body.action);
  }
}
