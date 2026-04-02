import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { JwtAuthGuard } from './jwt-auth.guard';
import { ApiKeyGuard } from './api-key.guard';
import { OpenApiKeyService } from '../../ai-config/open-api-key.service';

@Injectable()
export class CompositeAuthGuard implements CanActivate {
  private readonly jwtGuard: JwtAuthGuard;
  private readonly apiKeyGuard: ApiKeyGuard;

  constructor(
    private readonly reflector: Reflector,
    openApiKeyService: OpenApiKeyService,
  ) {
    // Passport guards extend AuthGuard which isn't designed for DI injection.
    // Instantiate them manually and inject only the service dependency.
    this.jwtGuard = new JwtAuthGuard();
    this.apiKeyGuard = new ApiKeyGuard(openApiKeyService);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    // Try JWT first
    try {
      const result = this.jwtGuard.canActivate(context);
      const ok = result instanceof Promise ? await result : result;
      if (ok) return true;
    } catch {
      // JWT failed — fall through to API key
    }

    // Fallback to API key
    return this.apiKeyGuard.canActivate(context);
  }
}
