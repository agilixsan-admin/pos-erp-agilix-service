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
import { InventoryStock } from './inventory-stock.entity';

@Entity('inventory_items')
@Index(['tenantId', 'sku'])
export class InventoryItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column()
  name!: string;

  @Column({ type: 'varchar', nullable: true })
  sku!: string | null;

  @Column({ default: 'pcs' })
  unit!: string;

  @Column({
    name: 'minimum_stock',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
  })
  minimumStock!: number;

  @Column({ default: 'ACTIVE' })
  status!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;

  @ManyToOne(() => Tenant, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: Tenant;

  @OneToMany(() => InventoryStock, (stock) => stock.inventoryItem)
  stocks!: InventoryStock[];
}
