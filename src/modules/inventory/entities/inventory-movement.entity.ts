import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Tenant } from '../../tenant/tenant.entity';
import { Outlet } from '../../outlet/outlet.entity';
import { InventoryItem } from './inventory-item.entity';
import { ReasonCategory } from './reason-category.entity';
import { User } from '../../user/user.entity';

@Entity('inventory_movements')
@Index(['tenantId', 'outletId', 'inventoryItemId'])
@Index(['tenantId', 'movementDate'])
export class InventoryMovement {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'outlet_id', type: 'uuid' })
  outletId!: string;

  @Column({ name: 'inventory_item_id', type: 'uuid' })
  inventoryItemId!: string;

  @Column({ name: 'movement_type' })
  movementType!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  quantity!: number;

  @Column({ name: 'reference_type', type: 'varchar', nullable: true })
  referenceType!: string | null;

  @Column({ name: 'reference_id', type: 'varchar', nullable: true })
  referenceId!: string | null;

  @Column({ name: 'reason_category_id', type: 'uuid', nullable: true })
  reasonCategoryId!: string | null;

  @Column({ type: 'varchar', nullable: true })
  notes!: string | null;

  @Column({
    name: 'movement_date',
    type: 'timestamptz',
    default: () => 'now()',
  })
  movementDate!: Date;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

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
