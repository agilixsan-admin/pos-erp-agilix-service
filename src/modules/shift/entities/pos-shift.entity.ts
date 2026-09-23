import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Tenant } from '../../tenant/tenant.entity';
import { Outlet } from '../../outlet/outlet.entity';
import { User } from '../../user/user.entity';
import { PettyCashTransaction } from './petty-cash-transaction.entity';

@Entity('pos_shifts')
@Index(['tenantId', 'outletId'])
@Index(['tenantId', 'userId', 'status'])
export class PosShift {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'outlet_id', type: 'uuid' })
  outletId!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'opened_at', type: 'timestamptz', default: () => 'now()' })
  openedAt!: Date;

  @Column({ name: 'closed_at', type: 'timestamptz', nullable: true })
  closedAt!: Date | null;

  @Column({
    name: 'opening_cash',
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
  })
  openingCash!: number;

  @Column({
    name: 'expected_cash',
    type: 'numeric',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  expectedCash!: number | null;

  @Column({
    name: 'actual_cash',
    type: 'numeric',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  actualCash!: number | null;

  @Column({
    name: 'cash_difference',
    type: 'numeric',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  cashDifference!: number | null;

  @Column({
    name: 'total_cash_sales',
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
  })
  totalCashSales!: number;

  @Column({
    name: 'total_cash_out',
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
  })
  totalCashOut!: number;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ type: 'varchar', length: 20, default: 'OPEN' })
  status!: 'OPEN' | 'CLOSED';

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

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @OneToMany(() => PettyCashTransaction, (pettyCash) => pettyCash.shift)
  pettyCashTransactions!: PettyCashTransaction[];
}
