import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Role } from './role.entity';
import { PermissionGuard } from '../../common/guards/permission.guard';

@Module({
  imports: [TypeOrmModule.forFeature([Role])],
  providers: [PermissionGuard],
  exports: [PermissionGuard, TypeOrmModule],
})
export class RbacModule {}
