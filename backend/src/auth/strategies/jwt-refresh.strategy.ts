import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';

export interface JwtRefreshPayload {
  sub: string;
  tenantId: string;
  refreshToken: string;
}

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('auth.jwtRefreshSecret') ?? configService.get<string>('JWT_REFRESH_SECRET') ?? 'dev-refresh-secret',
      passReqToCallback: true,
    });
  }

  validate(req: Request, payload: { sub: string; tenantId: string }): JwtRefreshPayload {
    const authHeader = req.headers.authorization;
    const refreshToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!refreshToken) throw new UnauthorizedException('缺少 refresh token');
    return { ...payload, refreshToken };
  }
}
