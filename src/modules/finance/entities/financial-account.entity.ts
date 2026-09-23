import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Tenant } from '../../tenant/tenant.entity';
import { Outlet } from '../../outlet/outlet.entity';

@Entity('financial_accounts')
@Index(['tenantId'])
export class FinancialAccount {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'outlet_id', type: 'uuid', nullable: true })
  outletId!: string | null;

  @Column({ name: 'account_code', type: 'varchar', length: 50 })
  accountCode!: string;

  @Column({ name: 'account_name', type: 'varchar', length: 150 })
  accountName!: string;

  @Column({ name: 'account_type', type: 'varchar', length: 30 })
  accountType!: 'CASH' | 'BANK' | 'EWALLET' | 'PAYMENT_GATEWAY';

  @Column({
    name: 'account_number',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  accountNumber!: string | null;

  @Column({ name: 'bank_name', type: 'varchar', length: 100, nullable: true })
  bankName!: string | null;

  @Column({
    name: 'current_balance',
    type: 'numeric',
    precision: 15,
    scale: 2,
    default: 0,
  })
  currentBalance!: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @ManyToOne(() => Tenant, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: Tenant;

  @ManyToOne(() => Outlet, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'outlet_id' })
  outlet!: Outlet | null;
}
