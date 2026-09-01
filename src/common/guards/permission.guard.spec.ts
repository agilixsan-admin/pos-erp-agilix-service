import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionGuard } from './permission.guard';

describe('PermissionGuard', () => {
  const getAllAndOverride = jest.fn();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockReflector = { getAllAndOverride } as any as Reflector;

  let guard: PermissionGuard;

  const buildContext = (
    user: unknown,
    permissions: string[] | null = null,
  ): ExecutionContext => {
    getAllAndOverride.mockReturnValue(permissions);
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as unknown as ExecutionContext;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    guard = new PermissionGuard(mockReflector);
  });

  it('allows request when no permissions are required on the route', () => {
    const ctx = buildContext({ role: { menuAccess: [] } }, null);

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows request when user has the required permission', () => {
    const ctx = buildContext(
      { role: { menuAccess: ['order.create', 'order.read'] } },
      ['order.create'],
    );

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows request when user has all required permissions', () => {
    const ctx = buildContext(
      {
        role: { menuAccess: ['order.create', 'order.read', 'payment.create'] },
      },
      ['order.create', 'payment.create'],
    );

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('throws ForbiddenException when user is missing a required permission', () => {
    const ctx = buildContext({ role: { menuAccess: ['order.read'] } }, [
      'inventory.adjust',
    ]);

    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when user has no role', () => {
    const ctx = buildContext({ role: null }, ['order.create']);

    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when user has empty menuAccess', () => {
    const ctx = buildContext({ role: { menuAccess: [] } }, ['order.create']);

    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('allows request when user isSuperAdmin regardless of permissions', () => {
    const ctx = buildContext({ isSuperAdmin: true, role: { menuAccess: [] } }, [
      'order.create',
      'inventory.adjust',
      'role.delete',
    ]);

    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('throws ForbiddenException when only some required permissions are present', () => {
    const ctx = buildContext({ role: { menuAccess: ['order.create'] } }, [
      'order.create',
      'inventory.adjust',
    ]);

    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('CASHIER cannot access inventory.adjust', () => {
    const ctx = buildContext(
      {
        role: { menuAccess: ['order.read', 'order.create', 'payment.create'] },
      },
      ['inventory.adjust'],
    );

    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('MANAGER can access inventory.adjust', () => {
    const ctx = buildContext(
      {
        role: {
          menuAccess: [
            'inventory.read',
            'inventory.adjust',
            'order.create',
            'report.read',
          ],
        },
      },
      ['inventory.adjust'],
    );

    expect(guard.canActivate(ctx)).toBe(true);
  });
});
