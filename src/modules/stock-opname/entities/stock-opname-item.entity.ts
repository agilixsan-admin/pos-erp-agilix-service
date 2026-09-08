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
import { StockOpname } from './stock-opname.entity';
import { InventoryItem } from '../../inventory/entities/inventory-item.entity';

@Entity('stock_opname_items')
@Index(['tenantId', 'stockOpnameId'])
@Index(['tenantId', 'inventoryItemId'])
@Index(['status'])
export class StockOpnameItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'stock_opname_id', type: 'uuid' })
  stockOpnameId!: string;

  @Column({ name: 'inventory_item_id', type: 'uuid' })
  inventoryItemId!: string;

  @Column({
    name: 'system_stock',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string | number) => Number(value),
    },
  })
  systemStock!: number;

  @Column({
    name: 'actual_stock',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
    transformer: {
      to: (value: number | null) => value,
      from: (value: string | number | null) =>
        value !== null && value !== undefined ? Number(value) : null,
    },
  })
  actualStock!: number | null;

  @Column({
    name: 'difference',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string | number) => Number(value),
    },
  })
  difference!: number;

  @Column({
    type: 'varchar',
    length: 50,
    default: 'UNCOUNTED',
  })
  status!: 'UNCOUNTED' | 'MATCH' | 'DEFICIT' | 'SURPLUS';

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @ManyToOne(() => Tenant, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: Tenant;

  @ManyToOne(() => StockOpname, (opname) => opname.items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'stock_opname_id' })
  stockOpname!: StockOpname;

  @ManyToOne(() => InventoryItem, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'inventory_item_id' })
  inventoryItem!: InventoryItem;
}
