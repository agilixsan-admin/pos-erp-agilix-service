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
import { InventoryItem } from '../../inventory/entities/inventory-item.entity';

@Entity('packagings')
@Index(['tenantId'])
@Index(['outletId'])
@Index(['status'])
export class Packaging {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'outlet_id', type: 'uuid', nullable: true })
  outletId!: string | null;

  @Column({ type: 'varchar', length: 150 })
  name!: string;

  @Column({ name: 'inventory_item_id', type: 'uuid', nullable: true })
  inventoryItemId!: string | null;

  @Column({
    name: 'extra_price',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string | number) => Number(value),
    },
  })
  extraPrice!: number;

  @Column({
    name: 'apply_to_order_type',
    type: 'varchar',
    length: 50,
    default: 'TAKE_AWAY',
  })
  applyToOrderType!: 'TAKE_AWAY' | 'ALL' | 'CUSTOM';

  @Column({ type: 'varchar', length: 50, default: 'ACTIVE' })
  status!: 'ACTIVE' | 'INACTIVE';

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;

  @ManyToOne(() => Tenant, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: Tenant;

  @ManyToOne(() => Outlet, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'outlet_id' })
  outlet!: Outlet | null;

  @ManyToOne(() => InventoryItem, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'inventory_item_id' })
  inventoryItem!: InventoryItem | null;
}
