import { SetMetadata } from '@nestjs/common';

export const REQUIRED_MENUS_KEY = 'requiredMenus';
export const RequiredMenus = (...menus: string[]) =>
  SetMetadata(REQUIRED_MENUS_KEY, menus);
