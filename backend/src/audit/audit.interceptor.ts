import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { AuditService } from './audit.service';
import { JwtPayload } from '../auth/strategies/jwt.strategy';

interface RequestWithUser {
  method: string;
  url: string;
  user?: JwtPayload & { name?: string; authSource?: string };
  headers: Record<string, string | string[] | undefined>;
  tenantId?: string;
  ip?: string;
  connection?: { remoteAddress?: string };
  socket?: { remoteAddress?: string };
}

function extractResourceFromUrl(url: string): string {
  const cleanUrl = url.split('?')[0];
  const segments = cleanUrl.replace(/^\//, '').split('/');
  return segments[0] ?? 'unknown';
}

function mapMethodToAction(method: string, url: string): string {
  const cleanUrl = url.split('?')[0];
  const segments = cleanUrl.replace(/^\//, '').split('/');
  const hasResourceId = segments.length > 1 && segments[1]?.length > 0;

  switch (method.toUpperCase()) {
    case 'POST':
      return 'create';
    case 'PUT':
    case 'PATCH':
      return hasResourceId ? 'update' : 'batch_update';
    case 'DELETE':
      return 'delete';
    default:
      return method.toLowerCase();
  }
}

function extractIpAddress(req: RequestWithUser): string | undefined {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ip = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
    return ip?.trim();
  }
  return req.ip ?? req.connection?.remoteAddress ?? req.socket?.remoteAddress;
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const method = request.method?.toUpperCase() ?? '';

    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
      return next.handle();
    }

    const user = request.user;
    if (!user?.sub) {
      return next.handle();
    }

    const tenantId = request.tenantId;
    if (!tenantId) {
      return next.handle();
    }

    const resource = extractResourceFromUrl(request.url);
    const action = mapMethodToAction(method, request.url);
    const ipAddress = extractIpAddress(request);
    const source = user.authSource ?? 'web';

    return next.handle().pipe(
      tap({
        next: (responseBody: unknown) => {
          void this.auditService
            .record({
              tenantId,
              actorId: user.sub,
              actorName: user.name ?? user.email ?? user.sub,
              action,
              resource,
              resourceId: undefined,
              newData:
                responseBody && typeof responseBody === 'object'
                  ? (responseBody as Record<string, unknown>)
                  : undefined,
              ipAddress,
              source,
            })
            .catch(() => {
              // 审计日志写入失败不影响主流程
            });
        },
        error: () => {
          void this.auditService
            .record({
              tenantId,
              actorId: user.sub,
              actorName: user.name ?? user.email ?? user.sub,
              action: `${action}_failed`,
              resource,
              ipAddress,
              source,
            })
            .catch(() => {
              // 审计日志写入失败不影响主流程
            });
        },
      }),
    );
  }
}
