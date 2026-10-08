import { User } from '../../modules/user/user.entity';

/**
 * Determine if a user has true tenant-wide administrative authority to view
 * aggregated data across all outlets or switch freely between any outlet.
 *
 * Evaluation:
 * 1. Super Admin flag (`user.isSuperAdmin === true`)
 * 2. Unassigned headquarters user without any specific outlet restrictions:
 *    (!user.outletId && (!user.assignedOutlets || user.assignedOutlets.length === 0))
 *    and possesses wildcard access ('*') or an executive role (Owner / Direktur).
 *
 * NOTE: Regular staff, Store Managers, and Area Managers who have assigned outlets
 * are NEVER tenant-wide, even if they have reporting permissions (e.g. 'report.read').
 */
export function isTenantWideUser(user: User): boolean {
  if (user.isSuperAdmin) return true;

  const menuAccess = user.role?.menuAccess ?? [];
  // Executive and business owners always have tenant-wide authority
  if (
    menuAccess.includes('*') ||
    /owner|direktur/i.test(user.role?.name || '')
  ) {
    return true;
  }

  const hasSpecificOutlets =
    Boolean(user.outletId) ||
    (user.assignedOutlets && user.assignedOutlets.length > 0);

  if (!hasSpecificOutlets) {
    if (
      menuAccess.includes('report.read') ||
      menuAccess.includes('report.financial.read') ||
      /finance|akuntan|admin/i.test(user.role?.name || '')
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Resolve the effective outlet ID for multi-tenant and multi-outlet scoped queries.
 *
 * Rules:
 * 1. If outletId === 'ALL':
 *    - For true tenant-wide / Super Admin users: returns `undefined` (query all outlets).
 *    - For restricted staff/managers: returns their primary permitted outlet (prevents cross-outlet leakage).
 * 2. If outletId is a specific outlet UUID:
 *    - For true tenant-wide / Super Admin users: returns the requested outlet ID.
 *    - For restricted staff/managers: returns requested ID ONLY IF it is in their permitted outlets;
 *      otherwise falls back to their primary outlet.
 * 3. If outletId is omitted / undefined / empty:
 *    - For true tenant-wide / Super Admin users: returns `undefined` (aggregate all outlets).
 *    - For restricted staff/managers: returns their primary permitted outlet.
 */
export function resolveEffectiveOutletId(
  user: User,
  outletId?: string,
): string | undefined {
  const isTenantWide = isTenantWideUser(user);

  // Collect all permitted outlet IDs for this user
  const permittedIds = new Set<string>();
  if (user.outletId) permittedIds.add(user.outletId);
  if (user.assignedOutlets && user.assignedOutlets.length > 0) {
    user.assignedOutlets.forEach((o) => permittedIds.add(o.id));
  }

  const primaryOutletId =
    user.outletId ??
    (permittedIds.size > 0 ? Array.from(permittedIds)[0] : undefined);

  const requested =
    outletId && outletId !== 'ALL' && outletId.trim() !== ''
      ? outletId.trim()
      : undefined;

  // 1. Specific outlet requested
  if (requested) {
    if (!isTenantWide) {
      if (permittedIds.size > 0 && !permittedIds.has(requested)) {
        return primaryOutletId;
      }
    }
    return requested;
  }

  // 2. 'ALL' requested
  if (outletId === 'ALL') {
    if (isTenantWide) {
      return undefined;
    }
    return primaryOutletId;
  }

  // 3. Omitted / undefined
  if (isTenantWide) {
    return undefined;
  }

  return primaryOutletId;
}
