import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { TenantStatus } from '../../modules/tenant/tenant-status.enum';
import { TenantService } from '../../modules/tenant/tenant.service';
import { AuthenticatedRequest } from '../interfaces/authenticated-request';

@Injectable()
export class TenantStatusGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tenantService: TenantService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    const user = context.switchToHttp().getRequest<AuthenticatedRequest>().user;
    if (!user) return true;
    const tenant = await this.tenantService.findById(user.tenantId);
    if (!tenant || tenant.status === TenantStatus.LOCKED) {
      throw new ForbiddenException({
        success: false,
        message: 'Tenant is locked',
        code: 'TENANT_LOCKED',
      });
    }
    return true;
  }
}
