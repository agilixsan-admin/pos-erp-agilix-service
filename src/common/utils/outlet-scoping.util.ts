import { User } from '../../modules/user/user.entity';

/**
 * Determine if a user has tenant-wide or administrative authority to view
 * aggregated data across all outlets or switch between outlets.
 *
 * Evaluation is based strictly on dynamic RBAC permissions and user scoping:
 * 1. Super Admin flag (`user.isSuperAdmin === true`)
 * 2. Unassigned outlet (`!user.outletId` -> headquarters / tenant-wide user)
 * 3. Wildcard permission (`menuAccess.includes('*')`)
 * 4. Reporting & Financial permissions (`menuAccess.includes('report.read')` or `menuAccess.includes('report.financial.read')` or `menuAccess.includes('finance.account.read')`)
 * 5. Fallback check on managerial role designations (e.g. Manager, Owner, Admin, Supervisor, Akuntan)
 */
export function isTenantWideUser(user: User): boolean {
  if (user.isSuperAdmin) return true;
  if (!user.outletId) return true;

  const menuAccess = user.role?.menuAccess ?? [];
  if (
    menuAccess.includes('*') ||
    menuAccess.includes('report.read') ||
    menuAccess.includes('report.financial.read') ||
    menuAccess.includes('finance.account.read')
  ) {
    return true;
  }

  const roleName = user.role?.name?.toLowerCase() || '';
  if (
    /owner|admin|manager|supervisor|direktur|akuntan|finance/i.test(roleName)
  ) {
    return true;
  }

  return false;
}

/**
 * Resolve the effective outlet ID for multi-tenant and multi-outlet scoped queries.
 *
 * Rules:
 * 1. If outletId === 'ALL':
 *    - For tenant-wide / managerial users: returns `undefined` (query all outlets without filter).
 *    - For restricted regular staff: returns `user.outletId` (preserve outlet isolation).
 * 2. If outletId is a specific outlet UUID:
 *    - For tenant-wide / managerial users: returns the requested outlet ID.
 *    - For restricted regular staff: returns `user.outletId` if attempting to cross outlets.
 * 3. If outletId is omitted / undefined / empty:
 *    - If user has no outletId: returns `undefined` (tenant-wide).
 *    - If user has outletId: returns `user.outletId` (default to their assigned home outlet).
 */
export function resolveEffectiveOutletId(
  user: User,
  outletId?: string,
): string | undefined {
  const isTenantWide = isTenantWideUser(user);

  const requested =
    outletId && outletId !== 'ALL' && outletId.trim() !== ''
      ? outletId.trim()
      : undefined;

  // Collect all permitted outlet IDs for this user
  const permittedIds = new Set<string>();
  if (user.outletId) permittedIds.add(user.outletId);
  if (user.assignedOutlets && user.assignedOutlets.length > 0) {
    user.assignedOutlets.forEach((o) => permittedIds.add(o.id));
  }

  if (requested) {
    if (
      !isTenantWide &&
      permittedIds.size > 0 &&
      !permittedIds.has(requested)
    ) {
      return user.outletId ?? Array.from(permittedIds)[0];
    }
    return requested;
  }

  if (outletId === 'ALL') {
    return isTenantWide ? undefined : (user.outletId ?? undefined);
  }

  if (isTenantWide && !user.outletId) {
    return undefined;
  }

  return (
    user.outletId ??
    (permittedIds.size > 0 ? Array.from(permittedIds)[0] : undefined)
  );
}
