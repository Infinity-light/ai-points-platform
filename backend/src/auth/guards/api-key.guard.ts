import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { OpenApiKeyService } from '../../ai-config/open-api-key.service';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly openApiKeyService: OpenApiKeyService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const raw = req.headers['x-api-key'] as string | undefined;
    if (!raw) return false;

    const key = await this.openApiKeyService.validateKey(raw);
    if (!key) return false;

    // Inject user-like payload so downstream guards/services work uniformly
    (req as unknown as Record<string, unknown>)['user'] = {
      sub: key.createdBy,
      tenantId: key.tenantId,
      email: '',
      authSource: 'api_key',
    };
    (req as unknown as Record<string, unknown>)['tenantId'] = key.tenantId;
    return true;
  }
}
