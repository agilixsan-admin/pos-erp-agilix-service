import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Tenant } from '../../tenant/tenant.entity';
import { Outlet } from '../../outlet/outlet.entity';
import { Product } from '../../product/entities/product.entity';

export type DiscountCalculationType = 'PERCENTAGE' | 'FIXED';
export type DiscountValidityType =
  | 'ALWAYS_ACTIVE'
  | 'RECURRING_WEEKLY'
  | 'DATE_RANGE';
export type DiscountScope = 'ALL_PRODUCTS' | 'SPECIFIC_PRODUCTS';
export type DiscountStatus = 'ACTIVE' | 'INACTIVE';

@Entity('discounts')
@Index(['tenantId'])
@Index(['outletId'])
@Index(['status'])
@Index(['validityType'])
export class Discount {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'outlet_id', type: 'uuid', nullable: true })
  outletId!: string | null;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'varchar', length: 20, default: 'PERCENTAGE' })
  type!: DiscountCalculationType;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  value!: number;

  @Column({
    name: 'validity_type',
    type: 'varchar',
    length: 30,
    default: 'ALWAYS_ACTIVE',
  })
  validityType!: DiscountValidityType;

  @Column({
    name: 'recurring_days',
    type: 'text',
    array: true,
    nullable: true,
  })
  recurringDays!: string[] | null;

  @Column({ name: 'start_date', type: 'timestamptz', nullable: true })
  startDate!: Date | null;

  @Column({ name: 'end_date', type: 'timestamptz', nullable: true })
  endDate!: Date | null;

  @Column({
    name: 'min_order_amount',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
  })
  minOrderAmount!: number;

  @Column({
    name: 'max_discount_amount',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  maxDiscountAmount!: number | null;

  @Column({
    name: 'applicable_scope',
    type: 'varchar',
    length: 30,
    default: 'ALL_PRODUCTS',
  })
  applicableScope!: DiscountScope;

  @Column({ type: 'varchar', length: 20, default: 'ACTIVE' })
  status!: DiscountStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;

  @ManyToOne(() => Tenant, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: Tenant;

  @ManyToOne(() => Outlet, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'outlet_id' })
  outlet!: Outlet | null;

  @ManyToMany(() => Product, { onDelete: 'CASCADE' })
  @JoinTable({
    name: 'discount_products',
    joinColumn: { name: 'discount_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'product_id', referencedColumnName: 'id' },
  })
  products!: Product[];
}
