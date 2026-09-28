import {
  isTenantWideUser,
  resolveEffectiveOutletId,
} from './outlet-scoping.util';
import { User } from '../../modules/user/user.entity';

describe('outlet-scoping.util', () => {
  describe('isTenantWideUser (dynamic RBAC permissions)', () => {
    it('returns true if user isSuperAdmin', () => {
      const user = { isSuperAdmin: true, outletId: 'outlet-1' } as User;
      expect(isTenantWideUser(user)).toBe(true);
    });

    it('returns true if user has no outletId assigned (headquarters user)', () => {
      const user = { isSuperAdmin: false, outletId: null } as unknown as User;
      expect(isTenantWideUser(user)).toBe(true);
    });

    it('returns true if user role has wildcard access (*)', () => {
      const user = {
        isSuperAdmin: false,
        outletId: 'outlet-1',
        role: { menuAccess: ['*'], name: 'Custom Dynamic Role 123' },
      } as unknown as User;
      expect(isTenantWideUser(user)).toBe(true);
    });

    it('returns true for dynamic role with report.financial.read permission regardless of role name', () => {
      const user = {
        isSuperAdmin: false,
        outletId: 'outlet-1',
        role: {
          menuAccess: ['report.financial.read'],
          name: 'Staf Pembukuan Eksternal',
        },
      } as unknown as User;
      expect(isTenantWideUser(user)).toBe(true);
    });

    it('returns true for dynamic role with report.read permission regardless of role name', () => {
      const user = {
        isSuperAdmin: false,
        outletId: 'outlet-1',
        role: { menuAccess: ['report.read'], name: 'Analis Bisnis F&B' },
      } as unknown as User;
      expect(isTenantWideUser(user)).toBe(true);
    });

    it('returns true for dynamic managerial role names', () => {
      const roles = [
        'Store Manager',
        'Manager Operasional',
        'General Manager',
        'Owner',
        'Super Admin',
        'Admin Toko',
        'Finance & Accounting',
        'Supervisor Shift',
      ];
      for (const name of roles) {
        const user = {
          isSuperAdmin: false,
          outletId: 'outlet-1',
          role: { menuAccess: ['order.read'], name },
        } as unknown as User;
        expect(isTenantWideUser(user)).toBe(true);
      }
    });

    it('returns false for regular outlet staff (e.g. Kasir, Barista)', () => {
      const user = {
        isSuperAdmin: false,
        outletId: 'outlet-1',
        role: {
          menuAccess: ['order.read', 'order.create'],
          name: 'Kasir Utama',
        },
      } as unknown as User;
      expect(isTenantWideUser(user)).toBe(false);
    });
  });

  describe('resolveEffectiveOutletId', () => {
    const storeManager = {
      isSuperAdmin: false,
      outletId: 'outlet-deilema',
      role: {
        name: 'Store Manager',
        menuAccess: ['order.read', 'report.read', 'report.financial.read'],
      },
    } as unknown as User;

    const customAccountant = {
      isSuperAdmin: false,
      outletId: 'outlet-deilema',
      role: { name: 'Konsultan Pajak', menuAccess: ['report.financial.read'] },
    } as unknown as User;

    const cashier = {
      isSuperAdmin: false,
      outletId: 'outlet-deilema',
      role: { name: 'Kasir', menuAccess: ['order.read', 'payment.create'] },
    } as unknown as User;

    const superAdmin = {
      isSuperAdmin: true,
      outletId: null,
      role: null,
    } as unknown as User;

    it('allows Store Manager to query ALL branches (returns undefined for all branches)', () => {
      expect(resolveEffectiveOutletId(storeManager, 'ALL')).toBeUndefined();
    });

    it('allows Custom Dynamic Role with report.financial.read to query ALL branches', () => {
      expect(resolveEffectiveOutletId(customAccountant, 'ALL')).toBeUndefined();
    });

    it('allows Store Manager to switch to another branch (e.g. Bims Outlet)', () => {
      expect(resolveEffectiveOutletId(storeManager, 'outlet-bims')).toBe(
        'outlet-bims',
      );
    });

    it('defaults Store Manager to their home outlet when outletId is omitted', () => {
      expect(resolveEffectiveOutletId(storeManager, undefined)).toBe(
        'outlet-deilema',
      );
    });

    it('allows SuperAdmin to query ALL branches', () => {
      expect(resolveEffectiveOutletId(superAdmin, 'ALL')).toBeUndefined();
      expect(resolveEffectiveOutletId(superAdmin, undefined)).toBeUndefined();
    });

    it('blocks regular Cashier from querying ALL branches (falls back to home outlet)', () => {
      expect(resolveEffectiveOutletId(cashier, 'ALL')).toBe('outlet-deilema');
    });

    it('blocks regular Cashier from accessing other branches (falls back to home outlet)', () => {
      expect(resolveEffectiveOutletId(cashier, 'outlet-bims')).toBe(
        'outlet-deilema',
      );
    });

    it('allows regular Cashier to access their own branch', () => {
      expect(resolveEffectiveOutletId(cashier, 'outlet-deilema')).toBe(
        'outlet-deilema',
      );
    });
  });
});
