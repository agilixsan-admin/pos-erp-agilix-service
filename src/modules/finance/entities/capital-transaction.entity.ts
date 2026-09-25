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
import { User } from '../../user/user.entity';
import { FinancialAccount } from './financial-account.entity';

export type CapitalTransactionType =
  'CAPITAL_INJECTION' | 'OWNER_WITHDRAWAL' | 'LOAN_RECEIPT' | 'LOAN_REPAYMENT';

@Entity('capital_transactions')
@Index(['tenantId'])
@Index(['tenantId', 'transactionDate'])
@Index(['tenantId', 'outletId'])
export class CapitalTransaction {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'outlet_id', type: 'uuid', nullable: true })
  outletId!: string | null;

  @Column({ name: 'financial_account_id', type: 'uuid' })
  financialAccountId!: string;

  @Column({ type: 'varchar', length: 50 })
  type!: CapitalTransactionType;

  @Column({ type: 'numeric', precision: 15, scale: 2 })
  amount!: number;

  @Column({ name: 'transaction_date', type: 'date' })
  transactionDate!: string;

  @Column({ name: 'party_name', type: 'varchar', length: 150, nullable: true })
  partyName!: string | null;

  @Column({
    name: 'reference_number',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  referenceNumber!: string | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @ManyToOne(() => Tenant, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: Tenant;

  @ManyToOne(() => Outlet, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'outlet_id' })
  outlet!: Outlet | null;

  @ManyToOne(() => FinancialAccount, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'financial_account_id' })
  financialAccount!: FinancialAccount;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by' })
  creator!: User;
}
