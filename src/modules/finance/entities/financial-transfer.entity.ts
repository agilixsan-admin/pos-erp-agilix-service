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
import { User } from '../../user/user.entity';
import { FinancialAccount } from './financial-account.entity';

@Entity('financial_transfers')
@Index(['tenantId'])
export class FinancialTransfer {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'from_account_id', type: 'uuid' })
  fromAccountId!: string;

  @Column({ name: 'to_account_id', type: 'uuid' })
  toAccountId!: string;

  @Column({ type: 'numeric', precision: 15, scale: 2 })
  amount!: number;

  @Column({ name: 'transfer_date', type: 'date' })
  transferDate!: string;

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

  @ManyToOne(() => FinancialAccount, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'from_account_id' })
  fromAccount!: FinancialAccount;

  @ManyToOne(() => FinancialAccount, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'to_account_id' })
  toAccount!: FinancialAccount;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by' })
  creator!: User;
}
