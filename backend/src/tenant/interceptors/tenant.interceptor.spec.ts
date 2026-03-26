import { TenantInterceptor } from './tenant.interceptor';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';

describe('TenantInterceptor', () => {
  let interceptor: TenantInterceptor;

  beforeEach(() => {
    interceptor = new TenantInterceptor();
  });

  const createContext = (user?: { tenantId?: string }, headers?: Record<string, string>) => {
    const request: {
      user?: { tenantId?: string };
      headers: Record<string, string>;
      tenantId?: string;
    } = { user, headers: headers ?? {}, tenantId: undefined };
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  };

  const handler: CallHandler = { handle: () => of(null) };

  it('should extract tenantId from user object (JWT)', (done) => {
    const ctx = createContext({ tenantId: 'tenant-uuid' });
    const req = ctx.switchToHttp().getRequest() as { tenantId?: string };

    interceptor.intercept(ctx, handler).subscribe(() => {
      expect(req.tenantId).toBe('tenant-uuid');
      done();
    });
  });

  it('should fall back to x-tenant-id header', (done) => {
    const ctx = createContext(undefined, { 'x-tenant-id': 'header-tenant' });
    const req = ctx.switchToHttp().getRequest() as { tenantId?: string };

    interceptor.intercept(ctx, handler).subscribe(() => {
      expect(req.tenantId).toBe('header-tenant');
      done();
    });
  });

  it('should prefer user tenantId over header', (done) => {
    const ctx = createContext({ tenantId: 'user-tenant' }, { 'x-tenant-id': 'header-tenant' });
    const req = ctx.switchToHttp().getRequest() as { tenantId?: string };

    interceptor.intercept(ctx, handler).subscribe(() => {
      expect(req.tenantId).toBe('user-tenant');
      done();
    });
  });

  it('should not set tenantId if neither source provides it', (done) => {
    const ctx = createContext(undefined, {});
    const req = ctx.switchToHttp().getRequest() as { tenantId?: string };

    interceptor.intercept(ctx, handler).subscribe(() => {
      expect(req.tenantId).toBeUndefined();
      done();
    });
  });
});
