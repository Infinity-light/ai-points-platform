import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { Request } from 'express';

export const TENANT_CONTEXT_KEY = 'tenantId';

type TenantRequest = Request & {
  tenantId?: string;
  user?: { tenantId?: string };
};

@Injectable()
export class TenantInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<TenantRequest>();

    // 优先从 JWT 解析的 user 对象中获取（Auth 模块设置）
    const userTenantId = request.user?.tenantId;

    // 其次从请求头获取（超管操作或公共端点）
    const headerTenantId = request.headers['x-tenant-id'] as string | undefined;

    const tenantId = userTenantId ?? headerTenantId;

    if (tenantId) {
      request.tenantId = tenantId;
    }

    return next.handle();
  }
}
