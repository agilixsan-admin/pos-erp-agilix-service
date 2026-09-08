import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
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
import { InventoryCategory } from '../../inventory/entities/inventory-category.entity';
import { User } from '../../user/user.entity';
import { StockOpnameItem } from './stock-opname-item.entity';

@Entity('stock_opnames')
@Index(['tenantId'])
@Index(['tenantId', 'outletId'])
@Index(['tenantId', 'opnameNumber'])
@Index(['status'])
export class StockOpname {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'outlet_id', type: 'uuid' })
  outletId!: string;

  @Column({ name: 'opname_number', type: 'varchar', length: 50 })
  opnameNumber!: string;

  @Column({
    name: 'opname_date',
    type: 'timestamptz',
    default: () => 'now()',
  })
  opnameDate!: Date;

  @Column({ type: 'varchar', length: 50, default: 'IN_PROGRESS' })
  status!: 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

  @Column({ type: 'varchar', length: 50, default: 'ALL' })
  scope!: 'ALL' | 'CATEGORY';

  @Column({ name: 'category_id', type: 'uuid', nullable: true })
  categoryId!: string | null;

  @Column({ name: 'total_items', type: 'int', default: 0 })
  totalItems!: number;

  @Column({ name: 'counted_items', type: 'int', default: 0 })
  countedItems!: number;

  @Column({ name: 'matched_items', type: 'int', default: 0 })
  matchedItems!: number;

  @Column({ name: 'deficit_items', type: 'int', default: 0 })
  deficitItems!: number;

  @Column({ name: 'surplus_items', type: 'int', default: 0 })
  surplusItems!: number;

  @Column({
    name: 'total_difference_value',
    type: 'decimal',
    precision: 14,
    scale: 2,
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string | number) => Number(value),
    },
  })
  totalDifferenceValue!: number;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ name: 'finalized_at', type: 'timestamptz', nullable: true })
  finalizedAt!: Date | null;

  @Column({ name: 'finalized_by', type: 'uuid', nullable: true })
  finalizedBy!: string | null;

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

  @ManyToOne(() => InventoryCategory, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'category_id' })
  category!: InventoryCategory | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'finalized_by' })
  finalizer!: User | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  creator!: User | null;

  @OneToMany(() => StockOpnameItem, (item) => item.stockOpname, {
    cascade: true,
  })
  items!: StockOpnameItem[];
}
