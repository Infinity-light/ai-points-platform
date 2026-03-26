import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class TenantRequiredGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request & { tenantId?: string }>();
    if (!request.tenantId) {
      throw new UnauthorizedException('租户上下文缺失，请提供有效的身份认证');
    }
    return true;
  }
}
