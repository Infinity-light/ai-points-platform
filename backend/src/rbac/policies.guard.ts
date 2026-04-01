import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { CaslAbilityFactory } from './casl-ability.factory';
import {
  CHECK_POLICIES_KEY,
  PolicyMetadata,
} from './decorators/check-policies.decorator';
import { JwtPayload } from '../auth/strategies/jwt.strategy';

interface RequestWithUser extends Request {
  user?: JwtPayload;
}

@Injectable()
export class PoliciesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly abilityFactory: CaslAbilityFactory,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const policy = this.reflector.getAllAndOverride<PolicyMetadata | undefined>(
      CHECK_POLICIES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // 未标注 @CheckPolicies 的路由直接放行（向后兼容）
    if (!policy) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('未认证用户');
    }

    const ability = await this.abilityFactory.createForUser(
      user.sub,
      user.tenantId,
    );

    const allowed = ability.can(policy.action, policy.resource);
    if (!allowed) {
      throw new ForbiddenException('权限不足');
    }

    return true;
  }
}
