import 'dotenv/config';
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Tenant } from '../modules/tenant/tenant.entity';
import { Outlet } from '../modules/outlet/outlet.entity';
import { User } from '../modules/user/user.entity';
import { Role } from '../modules/rbac/role.entity';
import { ExternalCommand } from '../modules/webhook/external-command.entity';
import { AuditLog } from '../modules/audit/audit-log.entity';
import { Foundation1700000000000 } from './migrations/1700000000000-Foundation';

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USERNAME ?? 'postgres',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME ?? 'aglix_pos',
  ssl: process.env.DB_SSL === 'true',
  logging: process.env.DB_LOGGING === 'true',
  entities: [Tenant, Outlet, User, Role, ExternalCommand, AuditLog],
  migrations: [Foundation1700000000000],
  synchronize: false,
});
