import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { EmailService } from './email.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { UserModule } from '../user/user.module';
import { TenantModule } from '../tenant/tenant.module';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({}), // 动态 secret，在 AuthService 中 signAsync 时传入
    UserModule,
    TenantModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, EmailService, JwtStrategy, JwtRefreshStrategy],
  exports: [AuthService, JwtStrategy],
})
export class AuthModule {}
