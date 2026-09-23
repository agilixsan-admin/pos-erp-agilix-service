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
import { ExpenseCategory } from './expense-category.entity';
import { FinancialAccount } from './financial-account.entity';
import { PettyCashTransaction } from '../../shift/entities/petty-cash-transaction.entity';

@Entity('expenses')
@Index(['tenantId', 'outletId'])
@Index(['tenantId', 'expenseDate'])
export class Expense {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'outlet_id', type: 'uuid' })
  outletId!: string;

  @Column({ name: 'category_id', type: 'uuid' })
  categoryId!: string;

  @Column({ name: 'financial_account_id', type: 'uuid' })
  financialAccountId!: string;

  @Column({ type: 'numeric', precision: 15, scale: 2 })
  amount!: number;

  @Column({ name: 'expense_date', type: 'date' })
  expenseDate!: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  recipient!: string | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ name: 'receipt_url', type: 'text', nullable: true })
  receiptUrl!: string | null;

  @Column({ name: 'petty_cash_id', type: 'uuid', nullable: true })
  pettyCashId!: string | null;

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @ManyToOne(() => Tenant, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: Tenant;

  @ManyToOne(() => Outlet, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'outlet_id' })
  outlet!: Outlet;

  @ManyToOne(() => ExpenseCategory, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'category_id' })
  category!: ExpenseCategory;

  @ManyToOne(() => FinancialAccount, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'financial_account_id' })
  financialAccount!: FinancialAccount;

  @ManyToOne(() => PettyCashTransaction, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'petty_cash_id' })
  pettyCash!: PettyCashTransaction | null;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by' })
  creator!: User;
}
