import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { User } from './user.entity';
import { UserService } from './user.service';
import { UserController } from './controllers/user.controller';
import { Role } from '../rbac/role.entity';
import { Outlet } from '../outlet/outlet.entity';
import { Tenant } from '../tenant/tenant.entity';
import { UserInvitation } from './entities/user-invitation.entity';
import { AuditModule } from '../audit/audit.module';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Role, Outlet, Tenant, UserInvitation]),
    AuditModule,
    MailModule,
    ConfigModule,
  ],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService, TypeOrmModule],
})
export class UserModule {}
