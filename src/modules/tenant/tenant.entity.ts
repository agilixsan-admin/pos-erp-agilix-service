import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Outlet } from '../outlet/outlet.entity';
import { Role } from '../rbac/role.entity';
import { User } from '../user/user.entity';
import { AuditLog } from '../audit/audit-log.entity';
import { ExternalCommand } from '../webhook/external-command.entity';
import { TenantStatus } from './tenant-status.enum';

@Entity('tenants')
export class Tenant {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'business_name' })
  businessName!: string;

  @Column({ name: 'owner_name' })
  ownerName!: string;

  @Column({ name: 'owner_email' })
  ownerEmail!: string;

  @Column({ name: 'owner_phone', type: 'varchar', nullable: true })
  ownerPhone!: string | null;

  @Column({ name: 'plan_type' })
  planType!: string;

  @Column({ name: 'expiry_date', type: 'timestamptz', nullable: true })
  expiryDate!: Date | null;

  @Column({ type: 'enum', enum: TenantStatus, default: TenantStatus.ACTIVE })
  status!: TenantStatus;

  @Column({
    name: 'console_api_key',
    type: 'varchar',
    nullable: true,
    select: false,
  })
  consoleApiKey!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;

  @OneToMany(() => Outlet, (outlet) => outlet.tenant)
  outlets!: Outlet[];

  @OneToMany(() => User, (user) => user.tenant)
  users!: User[];

  @OneToMany(() => Role, (role) => role.tenant)
  roles!: Role[];

  @OneToMany(() => AuditLog, (auditLog) => auditLog.tenant)
  auditLogs!: AuditLog[];

  @OneToMany(() => ExternalCommand, (command) => command.tenant)
  externalCommands!: ExternalCommand[];
}
