import {
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TenantStatusGuard } from '../common/guards/tenant-status.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { TenantStatus } from '../modules/tenant/tenant-status.enum';
import { OutletService } from '../modules/outlet/outlet.service';
import { TableService } from '../modules/table/services/table.service';
import { CategoryService } from '../modules/product/services/category.service';
import { OrderService } from '../modules/order/services/order.service';
import { User } from '../modules/user/user.entity';
import { Outlet } from '../modules/outlet/outlet.entity';
import { Table } from '../modules/table/entities/table.entity';
import { Category } from '../modules/product/entities/category.entity';
import { Order } from '../modules/order/entities/order.entity';
import { Repository } from 'typeorm';

describe('Security & Hardening Tests (Phase 18)', () => {
  describe('1. Tenant Isolation Hardening', () => {
    const tenantA = '11111111-1111-1111-1111-111111111111';
    const tenantB = '22222222-2222-2222-2222-222222222222';

    it('prevents cross-tenant access in OutletService.findById', async () => {
      const mockRepo = {
        findOne: jest
          .fn()
          .mockImplementation(
            ({ where }: { where: { id: string; tenantId: string } }) => {
              // Outlet exists but belongs to tenant B
              if (where.tenantId === tenantB && where.id === 'outlet-b') {
                return Promise.resolve({ id: 'outlet-b', tenantId: tenantB });
              }
              return Promise.resolve(null);
            },
          ),
      } as unknown as Repository<Outlet>;

      const mockAuditService = { record: jest.fn() } as any;
      const service = new OutletService(mockRepo, mockAuditService);

      // Tenant A attempts to access Tenant B's outlet
      await expect(service.findById(tenantA, 'outlet-b')).rejects.toThrow(
        NotFoundException,
      );

      // Verify query strictly filtered by tenant A
      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'outlet-b', tenantId: tenantA },
      });
    });

    it('prevents cross-tenant access in TableService.findById', async () => {
      const mockRepo = {
        findOne: jest
          .fn()
          .mockImplementation(
            ({ where }: { where: { id: string; tenantId: string } }) => {
              if (where.tenantId === tenantA) return Promise.resolve(null);
              return Promise.resolve({ id: 'table-b', tenantId: tenantB });
            },
          ),
      } as unknown as Repository<Table>;

      const mockAuditService = { record: jest.fn() } as any;
      const service = new TableService(mockRepo, mockAuditService);

      await expect(service.findById(tenantA, 'table-b')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'table-b', tenantId: tenantA },
        }),
      );
    });

    it('prevents cross-tenant access in CategoryService.findById', async () => {
      const mockRepo = {
        findOne: jest
          .fn()
          .mockImplementation(
            ({ where }: { where: { id: string; tenantId: string } }) => {
              if (where.tenantId === tenantA) return Promise.resolve(null);
              return Promise.resolve({ id: 'cat-b', tenantId: tenantB });
            },
          ),
      } as unknown as Repository<Category>;

      const service = new CategoryService(mockRepo);

      await expect(service.findById(tenantA, 'cat-b')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'cat-b', tenantId: tenantA },
      });
    });

    it('prevents cross-tenant access in OrderService.findById', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };

      const mockOrderRepo = {
        createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
      } as unknown as Repository<Order>;

      const service = new OrderService(
        mockOrderRepo,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
      );

      await expect(service.findById(tenantA, 'order-b')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockOrderRepo.createQueryBuilder).toHaveBeenCalledWith('order');
    });
  });

  describe('2. Tenant Lock Hardening (TenantStatusGuard)', () => {
    let guard: TenantStatusGuard;
    const reflector = new Reflector();
    const mockTenantService = {
      findById: jest.fn(),
    };

    const buildContext = (
      user: Partial<User> | null,
      isPublic = false,
    ): ExecutionContext => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(isPublic);
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
      guard = new TenantStatusGuard(reflector, mockTenantService as any);
    });

    it('allows operational requests when tenant status is ACTIVE', async () => {
      mockTenantService.findById.mockResolvedValue({
        id: 'tenant-1',
        status: TenantStatus.ACTIVE,
      });

      const ctx = buildContext({
        tenantId: 'tenant-1',
      });

      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });

    it('rejects operational requests with 403 Forbidden when tenant status is LOCKED', async () => {
      mockTenantService.findById.mockResolvedValue({
        id: 'tenant-1',
        status: TenantStatus.LOCKED,
      });

      const ctx = buildContext({
        tenantId: 'tenant-1',
      });

      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });

    it('bypasses tenant lock check for public endpoints (such as webhooks)', async () => {
      const ctx = buildContext(
        {
          tenantId: 'tenant-1',
        },
        true, // isPublic = true
      );

      await expect(guard.canActivate(ctx)).resolves.toBe(true);
      expect(mockTenantService.findById).not.toHaveBeenCalled();
    });

    it('allows request when user is not present in request context', async () => {
      const ctx = buildContext(null);

      await expect(guard.canActivate(ctx)).resolves.toBe(true);
      expect(mockTenantService.findById).not.toHaveBeenCalled();
    });
  });

  describe('3. RBAC & Privilege Escalation Hardening (PermissionGuard)', () => {
    let guard: PermissionGuard;
    const mockReflector = {
      getAllAndOverride: jest.fn(),
    } as unknown as Reflector;

    const buildContext = (
      user: any,
      requiredPermissions: string[] | null = null,
    ): ExecutionContext => {
      jest
        .spyOn(mockReflector, 'getAllAndOverride')
        .mockReturnValue(requiredPermissions);
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

    it('allows Cashier to perform order creation and payment', () => {
      const cashierUser = {
        role: {
          name: 'CASHIER',
          menuAccess: ['order.read', 'order.create', 'payment.create'],
        },
      };

      const ctx = buildContext(cashierUser, ['order.create']);
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('blocks Cashier from attempting stock adjustment (Privilege Escalation)', () => {
      const cashierUser = {
        role: {
          name: 'CASHIER',
          menuAccess: ['order.read', 'order.create', 'payment.create'],
        },
      };

      const ctx = buildContext(cashierUser, ['inventory.adjust']);
      expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    });

    it('blocks Cashier from role management or deletion', () => {
      const cashierUser = {
        role: {
          name: 'CASHIER',
          menuAccess: ['order.read', 'order.create', 'payment.create'],
        },
      };

      const ctx = buildContext(cashierUser, ['role.delete']);
      expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    });

    it('allows Owner with wildcard "*" access to perform any action', () => {
      const ownerUser = {
        role: {
          name: 'OWNER',
          menuAccess: ['*'],
        },
      };

      const ctx1 = buildContext(ownerUser, ['inventory.adjust']);
      const ctx2 = buildContext(ownerUser, ['role.delete']);
      const ctx3 = buildContext(ownerUser, ['settings.manage']);

      expect(guard.canActivate(ctx1)).toBe(true);
      expect(guard.canActivate(ctx2)).toBe(true);
      expect(guard.canActivate(ctx3)).toBe(true);
    });

    it('allows SuperAdmin to bypass all permission requirements regardless of role', () => {
      const superAdminUser = {
        isSuperAdmin: true,
        role: null,
      };

      const ctx = buildContext(superAdminUser, [
        'role.delete',
        'settings.manage',
      ]);
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('rejects access when user role is inactive or null', () => {
      const userWithoutRole = {
        isSuperAdmin: false,
        role: null,
      };

      const ctx = buildContext(userWithoutRole, ['order.read']);
      expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    });
  });
});
