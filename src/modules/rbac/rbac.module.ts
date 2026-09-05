import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Role } from './role.entity';
import { User } from '../user/user.entity';
import { Outlet } from '../outlet/outlet.entity';
import { AuditModule } from '../audit/audit.module';
import { RoleService } from './services/role.service';
import { RoleController } from './controllers/role.controller';
import { PermissionGuard } from '../../common/guards/permission.guard';

@Module({
  imports: [TypeOrmModule.forFeature([Role, User, Outlet]), AuditModule],
  controllers: [RoleController],
  providers: [PermissionGuard, RoleService],
  exports: [PermissionGuard, RoleService, TypeOrmModule],
})
export class RbacModule {}
