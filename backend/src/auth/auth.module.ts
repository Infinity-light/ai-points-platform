import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import Redis from 'ioredis';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { EmailService } from './email.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { CompositeAuthGuard } from './guards/composite-auth.guard';
import { UserModule } from '../user/user.module';
import { TenantModule } from '../tenant/tenant.module';
import { AiConfigModule } from '../ai-config/ai-config.module';
import { UserRole } from '../rbac/entities/user-role.entity';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({}),
    TypeOrmModule.forFeature([UserRole]),
    UserModule,
    TenantModule,
    AiConfigModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    EmailService,
    JwtStrategy,
    JwtRefreshStrategy,
    CompositeAuthGuard,
    {
      provide: APP_GUARD,
      useClass: CompositeAuthGuard,
    },
    {
      provide: 'REDIS_CLIENT',
      useFactory: (configService: ConfigService) => {
        return new Redis({
          host: configService.get<string>('redis.host'),
          port: configService.get<number>('redis.port'),
          password: configService.get<string | undefined>('redis.password'),
          db: configService.get<number>('redis.db'),
        });
      },
      inject: [ConfigService],
    },
  ],
  exports: [AuthService, JwtStrategy],
})
export class AuthModule {}
