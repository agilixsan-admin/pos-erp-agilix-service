import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
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
import { Purchase } from './purchase.entity';
import { FinancialAccount } from '../../finance/entities/financial-account.entity';

@Entity('purchase_payments')
@Index(['tenantId'])
@Index(['tenantId', 'outletId'])
@Index(['tenantId', 'purchaseId'])
@Index(['tenantId', 'paymentNumber'])
export class PurchasePayment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'outlet_id', type: 'uuid' })
  outletId!: string;

  @Column({ name: 'purchase_id', type: 'uuid' })
  purchaseId!: string;

  @Column({ name: 'financial_account_id', type: 'uuid' })
  financialAccountId!: string;

  @Column({ name: 'payment_number', type: 'varchar', length: 50 })
  paymentNumber!: string;

  @Column({
    name: 'payment_date',
    type: 'timestamptz',
    default: () => 'now()',
  })
  paymentDate!: Date;

  @Column({
    name: 'amount',
    type: 'decimal',
    precision: 14,
    scale: 2,
    transformer: {
      to: (value: number) => value,
      from: (value: string | number) => Number(value),
    },
  })
  amount!: number;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;

  @ManyToOne(() => Tenant, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: Tenant;

  @ManyToOne(() => Outlet, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'outlet_id' })
  outlet!: Outlet;

  @ManyToOne(() => Purchase, (purchase) => purchase.payments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'purchase_id' })
  purchase!: Purchase;

  @ManyToOne(() => FinancialAccount, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'financial_account_id' })
  financialAccount!: FinancialAccount;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  creator!: User | null;
}
