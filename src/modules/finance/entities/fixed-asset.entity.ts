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

@Entity('fixed_assets')
@Index(['tenantId', 'outletId'])
export class FixedAsset {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'outlet_id', type: 'uuid' })
  outletId!: string;

  @Column({ type: 'varchar', length: 150 })
  name!: string;

  @Column({ type: 'varchar', length: 100 })
  category!: string;

  @Column({ name: 'purchase_date', type: 'date' })
  purchaseDate!: string;

  @Column({
    name: 'purchase_cost',
    type: 'numeric',
    precision: 15,
    scale: 2,
  })
  purchaseCost!: number;

  @Column({ name: 'financial_account_id', type: 'uuid', nullable: true })
  financialAccountId!: string | null;

  @Column({ name: 'useful_life_months', type: 'integer' })
  usefulLifeMonths!: number;

  @Column({
    name: 'salvage_value',
    type: 'numeric',
    precision: 15,
    scale: 2,
    default: 0,
  })
  salvageValue!: number;

  @Column({
    name: 'depreciation_method',
    type: 'varchar',
    length: 30,
    default: 'STRAIGHT_LINE',
  })
  depreciationMethod!: string;

  @Column({ type: 'varchar', length: 20, default: 'ACTIVE' })
  status!: 'ACTIVE' | 'DISPOSED';

  @Column({ name: 'disposal_date', type: 'date', nullable: true })
  disposalDate!: string | null;

  @Column({
    name: 'disposal_price',
    type: 'numeric',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  disposalPrice!: number | null;

  @Column({ name: 'disposal_notes', type: 'text', nullable: true })
  disposalNotes!: string | null;

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

  @ManyToOne(() => FinancialAccount, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'financial_account_id' })
  financialAccount!: FinancialAccount | null;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by' })
  creator!: User;
}
