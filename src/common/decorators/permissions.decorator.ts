import { SetMetadata } from '@nestjs/common';

export const REQUIRED_MENUS_KEY = 'requiredMenus';
export const REQUIRED_PERMISSIONS_ANY_KEY = 'requiredPermissionsAny';
export const RequiredMenus = (...menus: string[]) =>
  SetMetadata(REQUIRED_MENUS_KEY, menus);
export const Permissions = (...permissions: string[]) =>
  SetMetadata(REQUIRED_MENUS_KEY, permissions);
export const PermissionsAny = (...permissions: string[]) =>
  SetMetadata(REQUIRED_PERMISSIONS_ANY_KEY, permissions);
