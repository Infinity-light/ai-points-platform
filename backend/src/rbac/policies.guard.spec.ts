import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PoliciesGuard } from './policies.guard';
import { CaslAbilityFactory } from './casl-ability.factory';
import { CHECK_POLICIES_KEY } from './decorators/check-policies.decorator';
import { createMongoAbility } from '@casl/ability';

const buildMockContext = (user?: { sub: string; tenantId: string; email: string }): ExecutionContext => {
  const request = { user };
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
};

describe('PoliciesGuard', () => {
  let guard: PoliciesGuard;
  let reflector: { getAllAndOverride: jest.Mock };
  let abilityFactory: { createForUser: jest.Mock };

  beforeEach(async () => {
    reflector = { getAllAndOverride: jest.fn() };
    abilityFactory = { createForUser: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PoliciesGuard,
        { provide: Reflector, useValue: reflector },
        { provide: CaslAbilityFactory, useValue: abilityFactory },
      ],
    }).compile();

    guard = module.get<PoliciesGuard>(PoliciesGuard);
  });

  it('应该在无 @CheckPolicies 时直接放行', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const ctx = buildMockContext();

    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
  });

  it('应该在用户有权限时放行', async () => {
    reflector.getAllAndOverride.mockReturnValue({ resource: 'tasks', action: 'read' });

    const ability = createMongoAbility([{ action: 'read', subject: 'tasks' }]);
    abilityFactory.createForUser.mockResolvedValue(ability);

    const ctx = buildMockContext({ sub: 'user-1', tenantId: 'tenant-1', email: 'a@b.com' });

    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
  });

  it('应该在用户无权限时抛出 ForbiddenException', async () => {
    reflector.getAllAndOverride.mockReturnValue({ resource: 'tenants', action: 'update' });

    const ability = createMongoAbility([{ action: 'read', subject: 'tasks' }]);
    abilityFactory.createForUser.mockResolvedValue(ability);

    const ctx = buildMockContext({ sub: 'user-1', tenantId: 'tenant-1', email: 'a@b.com' });

    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('应该在无认证用户时抛出 ForbiddenException', async () => {
    reflector.getAllAndOverride.mockReturnValue({ resource: 'tasks', action: 'read' });

    const ctx = buildMockContext(undefined);

    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });
});
