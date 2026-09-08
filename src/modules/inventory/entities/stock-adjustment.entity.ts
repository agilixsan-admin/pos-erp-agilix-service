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
import { InventoryItem } from './inventory-item.entity';
import { ReasonCategory } from './reason-category.entity';
import { User } from '../../user/user.entity';

@Entity('stock_adjustments')
@Index(['tenantId'])
@Index(['tenantId', 'outletId'])
@Index(['tenantId', 'adjustmentNumber'])
@Index(['tenantId', 'inventoryItemId'])
@Index(['tenantId', 'adjustmentDate'])
export class StockAdjustment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'outlet_id', type: 'uuid' })
  outletId!: string;

  @Column({ name: 'adjustment_number', type: 'varchar', length: 50 })
  adjustmentNumber!: string;

  @Column({
    name: 'adjustment_date',
    type: 'timestamptz',
    default: () => 'now()',
  })
  adjustmentDate!: Date;

  @Column({ type: 'varchar', length: 10 })
  type!: 'IN' | 'OUT';

  @Column({ name: 'inventory_item_id', type: 'uuid' })
  inventoryItemId!: string;

  @Column({
    name: 'previous_stock',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string | number) => Number(value),
    },
  })
  previousStock!: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: {
      to: (value: number) => value,
      from: (value: string | number) => Number(value),
    },
  })
  quantity!: number;

  @Column({
    name: 'current_stock',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string | number) => Number(value),
    },
  })
  currentStock!: number;

  @Column({ name: 'reason_category_id', type: 'uuid', nullable: true })
  reasonCategoryId!: string | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ name: 'image_url', type: 'text', nullable: true })
  imageUrl!: string | null;

  @Column({ type: 'varchar', length: 50, default: 'MANUAL' })
  source!: 'MANUAL' | 'STOCK_OPNAME';

  @Column({ type: 'varchar', length: 50, default: 'COMPLETED' })
  status!: string;

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

  @ManyToOne(() => InventoryItem, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'inventory_item_id' })
  inventoryItem!: InventoryItem;

  @ManyToOne(() => ReasonCategory, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'reason_category_id' })
  reasonCategory!: ReasonCategory | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'created_by' })
  creator!: User | null;
}
