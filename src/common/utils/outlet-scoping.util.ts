import { User } from '../../modules/user/user.entity';
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
