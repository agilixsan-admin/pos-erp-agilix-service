import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from '../modules/tenant/tenant.entity';
import { Outlet } from '../modules/outlet/outlet.entity';
import { User } from '../modules/user/user.entity';
import { Role } from '../modules/rbac/role.entity';
import { ExternalCommand } from '../modules/webhook/external-command.entity';
import { AuditLog } from '../modules/audit/audit-log.entity';
import { Foundation1700000000000 } from './migrations/1700000000000-Foundation';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        host: config.get<string>('database.host'),
        port: config.get<number>('database.port'),
        username: config.get<string>('database.username'),
        password: config.get<string>('database.password'),
        database: config.get<string>('database.name'),
        ssl: config.get<boolean>('database.ssl'),
        logging: config.get<boolean>('database.logging'),
        entities: [Tenant, Outlet, User, Role, ExternalCommand, AuditLog],
        migrations: [Foundation1700000000000],
        synchronize: false,
        autoLoadEntities: true,
      }),
    }),
  ],
})
export class DatabaseModule {}
