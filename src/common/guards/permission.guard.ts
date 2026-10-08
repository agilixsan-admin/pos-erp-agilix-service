import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  REQUIRED_MENUS_KEY,
  REQUIRED_PERMISSIONS_ANY_KEY,
} from '../decorators/permissions.decorator';
import { AuthenticatedRequest } from '../interfaces/authenticated-request';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const user = context.switchToHttp().getRequest<AuthenticatedRequest>().user;
    if (user?.isSuperAdmin) return true;
    const menuAccess = user?.role?.menuAccess ?? [];
    if (menuAccess.includes('*')) return true;

    // 1. Check PermissionsAny (OR condition: user must have at least one of the specified permissions)
    const permissionsAny = this.reflector.getAllAndOverride<string[]>(
      REQUIRED_PERMISSIONS_ANY_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (permissionsAny?.length) {
      const hasAny = permissionsAny.some((perm) => menuAccess.includes(perm));
      if (!hasAny) {
        throw new ForbiddenException({
          success: false,
          message: 'Permission denied',
          code: 'FORBIDDEN',
        });
      }
    }

    // 2. Check Permissions (AND condition: user must have all specified permissions)
    const requiredMenus = this.reflector.getAllAndOverride<string[]>(
      REQUIRED_MENUS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (requiredMenus?.length) {
      const hasAll = requiredMenus.every((menu) => menuAccess.includes(menu));
      if (!hasAll) {
        throw new ForbiddenException({
          success: false,
          message: 'Permission denied',
          code: 'FORBIDDEN',
        });
      }
    }

    return true;
  }
}
