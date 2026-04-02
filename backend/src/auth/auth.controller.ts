import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
} from '@nestjs/common';
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

interface RequestWithUser extends Request {
  user: JwtRefreshPayload & { sub: string; tenantId: string };
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

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
}
