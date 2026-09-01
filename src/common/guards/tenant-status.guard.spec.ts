import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TenantStatusGuard } from './tenant-status.guard';
import { TenantService } from '../../modules/tenant/tenant.service';
import { TenantStatus } from '../../modules/tenant/tenant-status.enum';

describe('TenantStatusGuard', () => {
  const getAllAndOverride = jest.fn();
  const findById = jest.fn();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockReflector = { getAllAndOverride } as any as Reflector;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockTenantService = { findById } as any as TenantService;

  let guard: TenantStatusGuard;

  const buildContext = (user: unknown, isPublic = false): ExecutionContext => {
    getAllAndOverride.mockReturnValue(isPublic);
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
    guard = new TenantStatusGuard(mockReflector, mockTenantService);
  });

  it('allows request when route is public', async () => {
    const ctx = buildContext(null, true);

    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(findById).not.toHaveBeenCalled();
  });

  it('allows request when no user is present (unauthenticated)', async () => {
    const ctx = buildContext(null, false);

    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(findById).not.toHaveBeenCalled();
  });

  it('allows request when tenant is ACTIVE', async () => {
    const ctx = buildContext({ tenantId: 'tenant-1' });
    findById.mockResolvedValue({
      id: 'tenant-1',
      status: TenantStatus.ACTIVE,
    });

    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
  });

  it('throws ForbiddenException with TENANT_LOCKED code when tenant is LOCKED', async () => {
    const ctx = buildContext({ tenantId: 'tenant-1' });
    findById.mockResolvedValue({
      id: 'tenant-1',
      status: TenantStatus.LOCKED,
    });

    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    await expect(guard.canActivate(ctx)).rejects.toThrow('Tenant is locked');
  });

  it('throws ForbiddenException when tenant is not found', async () => {
    const ctx = buildContext({ tenantId: 'tenant-unknown' });
    findById.mockResolvedValue(null);

    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('OWNER cannot bypass a LOCKED tenant', async () => {
    const ctx = buildContext({
      tenantId: 'tenant-1',
      role: { name: 'OWNER', menuAccess: ['*'] },
    });
    findById.mockResolvedValue({
      id: 'tenant-1',
      status: TenantStatus.LOCKED,
    });

    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });
});
