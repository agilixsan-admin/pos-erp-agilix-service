import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRED_MENUS_KEY } from '../decorators/permissions.decorator';
import { AuthenticatedRequest } from '../interfaces/authenticated-request';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredMenus = this.reflector.getAllAndOverride<string[]>(
      REQUIRED_MENUS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredMenus?.length) return true;

    const user = context.switchToHttp().getRequest<AuthenticatedRequest>().user;
    if (user?.isSuperAdmin) return true;
    const menuAccess = user?.role?.menuAccess ?? [];
    if (requiredMenus.every((menu) => menuAccess.includes(menu))) return true;
    throw new ForbiddenException({
      success: false,
      message: 'Permission denied',
      code: 'FORBIDDEN',
    });
  }
}
