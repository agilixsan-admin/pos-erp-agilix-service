import {
  isTenantWideUser,
  resolveEffectiveOutletId,
} from './outlet-scoping.util';
import { User } from '../../modules/user/user.entity';

describe('outlet-scoping.util', () => {
  describe('isTenantWideUser', () => {
    it('returns true if user isSuperAdmin', () => {
      const user = { isSuperAdmin: true, outletId: 'outlet-1' } as User;
      expect(isTenantWideUser(user)).toBe(true);
    });

    it('returns true if user is an unassigned headquarters owner/director with no specific outlets', () => {
      const user = {
        isSuperAdmin: false,
        outletId: null,
        assignedOutlets: [],
        role: { menuAccess: ['*'], name: 'Owner' },
      } as unknown as User;
      expect(isTenantWideUser(user)).toBe(true);
    });

    it('returns false for Store Manager assigned to an outlet, even with report.read permission', () => {
      const user = {
        isSuperAdmin: false,
        outletId: 'outlet-dellema',
        assignedOutlets: [{ id: 'outlet-dellema' }],
        role: {
          name: 'Store Manager',
          menuAccess: ['report.read', 'report.financial.read'],
        },
      } as unknown as User;
      expect(isTenantWideUser(user)).toBe(false);
    });

    it('returns false for Area Manager assigned to multiple outlets', () => {
      const user = {
        isSuperAdmin: false,
        outletId: 'outlet-1',
        assignedOutlets: [{ id: 'outlet-1' }, { id: 'outlet-2' }],
        role: {
          name: 'Area Manager',
          menuAccess: ['report.read'],
        },
      } as unknown as User;
      expect(isTenantWideUser(user)).toBe(false);
    });

    it('returns false for regular outlet staff (e.g. Kasir)', () => {
      const user = {
        isSuperAdmin: false,
        outletId: 'outlet-1',
        role: {
          menuAccess: ['order.read', 'order.create'],
          name: 'Kasir',
        },
      } as unknown as User;
      expect(isTenantWideUser(user)).toBe(false);
    });
  });

  describe('resolveEffectiveOutletId', () => {
    const storeManagerDellema = {
      isSuperAdmin: false,
      outletId: 'outlet-dellema',
      assignedOutlets: [{ id: 'outlet-dellema' }],
      role: {
        name: 'Store Manager',
        menuAccess: ['order.read', 'report.read', 'report.financial.read'],
      },
    } as unknown as User;

    const areaManager = {
      isSuperAdmin: false,
      outletId: 'outlet-dellema',
      assignedOutlets: [{ id: 'outlet-dellema' }, { id: 'outlet-store2' }],
      role: {
        name: 'Area Manager',
        menuAccess: ['report.read'],
      },
    } as unknown as User;

    const cashier = {
      isSuperAdmin: false,
      outletId: 'outlet-dellema',
      assignedOutlets: [{ id: 'outlet-dellema' }],
      role: { name: 'Kasir', menuAccess: ['order.read', 'payment.create'] },
    } as unknown as User;

    const superAdmin = {
      isSuperAdmin: true,
      outletId: null,
      role: null,
    } as unknown as User;

    const hqOwner = {
      isSuperAdmin: false,
      outletId: null,
      assignedOutlets: [],
      role: { name: 'Owner', menuAccess: ['*'] },
    } as unknown as User;

    describe('Super Admin and HQ Owner', () => {
      it('allows SuperAdmin to query ALL branches (returns undefined)', () => {
        expect(resolveEffectiveOutletId(superAdmin, 'ALL')).toBeUndefined();
        expect(resolveEffectiveOutletId(superAdmin, undefined)).toBeUndefined();
      });

      it('allows SuperAdmin to query a specific branch', () => {
        expect(resolveEffectiveOutletId(superAdmin, 'outlet-bims')).toBe('outlet-bims');
      });

      it('allows HQ Owner to query ALL branches', () => {
        expect(resolveEffectiveOutletId(hqOwner, 'ALL')).toBeUndefined();
        expect(resolveEffectiveOutletId(hqOwner, undefined)).toBeUndefined();
      });
    });

    describe('Store Manager assigned to 1 outlet (Dellema Coffee)', () => {
      it('blocks Store Manager from querying ALL branches (falls back to outlet-dellema)', () => {
        expect(resolveEffectiveOutletId(storeManagerDellema, 'ALL')).toBe('outlet-dellema');
      });

      it('blocks Store Manager from accessing unassigned branch (e.g. Bims Outlet, falls back to outlet-dellema)', () => {
        expect(resolveEffectiveOutletId(storeManagerDellema, 'outlet-bims')).toBe('outlet-dellema');
      });

      it('allows Store Manager to access their own branch', () => {
        expect(resolveEffectiveOutletId(storeManagerDellema, 'outlet-dellema')).toBe('outlet-dellema');
      });

      it('defaults Store Manager to their assigned branch when outletId is omitted', () => {
        expect(resolveEffectiveOutletId(storeManagerDellema, undefined)).toBe('outlet-dellema');
      });
    });

    describe('Area Manager assigned to multiple outlets (Dellema & Store 2)', () => {
      it('allows Area Manager to query first assigned outlet (outlet-dellema)', () => {
        expect(resolveEffectiveOutletId(areaManager, 'outlet-dellema')).toBe('outlet-dellema');
      });

      it('allows Area Manager to query second assigned outlet (outlet-store2)', () => {
        expect(resolveEffectiveOutletId(areaManager, 'outlet-store2')).toBe('outlet-store2');
      });

      it('blocks Area Manager from accessing unassigned branch (outlet-bims, falls back to primary outlet-dellema)', () => {
        expect(resolveEffectiveOutletId(areaManager, 'outlet-bims')).toBe('outlet-dellema');
      });

      it('blocks Area Manager from querying ALL branches (falls back to primary outlet-dellema)', () => {
        expect(resolveEffectiveOutletId(areaManager, 'ALL')).toBe('outlet-dellema');
      });
    });

    describe('Regular Cashier', () => {
      it('blocks Cashier from querying ALL branches (falls back to home outlet)', () => {
        expect(resolveEffectiveOutletId(cashier, 'ALL')).toBe('outlet-dellema');
      });

      it('blocks Cashier from accessing other branches (falls back to home outlet)', () => {
        expect(resolveEffectiveOutletId(cashier, 'outlet-bims')).toBe('outlet-dellema');
      });

      it('allows Cashier to access their own branch', () => {
        expect(resolveEffectiveOutletId(cashier, 'outlet-dellema')).toBe('outlet-dellema');
      });
    });
  });
});
