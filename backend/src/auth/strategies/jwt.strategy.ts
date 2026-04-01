import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

export interface JwtPayload {
  sub: string;      // userId
  email: string;
  tenantId: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('auth.jwtSecret') ?? configService.get<string>('JWT_SECRET') ?? 'dev-secret',
    });
  }

  validate(payload: JwtPayload): JwtPayload {
    if (!payload.sub || !payload.tenantId) {
      throw new UnauthorizedException('无效的 token');
    }
    return payload;
  }
}
