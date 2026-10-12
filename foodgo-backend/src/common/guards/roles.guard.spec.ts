import { describe, expect, it, vi } from 'vitest';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard.js';
import { UserType } from '../../generated/prisma/client.js';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  const createMockContext = (user?: any): ExecutionContext =>
    ({
      getHandler: vi.fn(),
      getClass: vi.fn(),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as unknown as ExecutionContext);

  it('allows access when no roles are required', () => {
    reflector = { getAllAndOverride: vi.fn().mockReturnValue(undefined) } as any;
    guard = new RolesGuard(reflector);

    const context = createMockContext({ type: UserType.CUSTOMER });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows access when user has the required ADMIN role', () => {
    reflector = { getAllAndOverride: vi.fn().mockReturnValue([UserType.ADMIN]) } as any;
    guard = new RolesGuard(reflector);

    const context = createMockContext({ type: UserType.ADMIN });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('rejects access with ForbiddenException when user has CUSTOMER role but ADMIN is required', () => {
    reflector = { getAllAndOverride: vi.fn().mockReturnValue([UserType.ADMIN]) } as any;
    guard = new RolesGuard(reflector);

    const context = createMockContext({ type: UserType.CUSTOMER });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('rejects access when user object is missing or has no type', () => {
    reflector = { getAllAndOverride: vi.fn().mockReturnValue([UserType.ADMIN]) } as any;
    guard = new RolesGuard(reflector);

    const context = createMockContext(undefined);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
