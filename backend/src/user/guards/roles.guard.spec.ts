import { RolesGuard } from './roles.guard';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Role } from '../enums/role.enum';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: jest.Mocked<Reflector>;

  const makeContext = (user?: { role: Role }): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() } as unknown as jest.Mocked<Reflector>;
    guard = new RolesGuard(reflector);
  });

  it('should allow access when no roles required', () => {
    reflector.getAllAndOverride.mockReturnValue(null);
    expect(guard.canActivate(makeContext())).toBe(true);
  });

  it('should allow access when user has required role', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.HR_ADMIN]);
    expect(guard.canActivate(makeContext({ role: Role.HR_ADMIN }))).toBe(true);
  });

  it('should throw ForbiddenException when user lacks required role', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.HR_ADMIN]);
    expect(() => guard.canActivate(makeContext({ role: Role.EMPLOYEE }))).toThrow(
      ForbiddenException,
    );
  });

  it('should throw ForbiddenException when user is not authenticated', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.EMPLOYEE]);
    expect(() => guard.canActivate(makeContext(undefined))).toThrow(ForbiddenException);
  });
});
