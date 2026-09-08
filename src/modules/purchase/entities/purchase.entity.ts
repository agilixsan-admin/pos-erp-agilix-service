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
import { Supplier } from '../../supplier/entities/supplier.entity';
import { User } from '../../user/user.entity';
import { PurchaseItem } from './purchase-item.entity';

@Entity('purchases')
@Index(['tenantId'])
@Index(['tenantId', 'outletId'])
@Index(['tenantId', 'purchaseNumber'])
@Index(['status'])
export class Purchase {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'outlet_id', type: 'uuid' })
  outletId!: string;

  @Column({ name: 'supplier_id', type: 'uuid' })
  supplierId!: string;

  @Column({ name: 'purchase_number', type: 'varchar', length: 50 })
  purchaseNumber!: string;

  @Column({
    name: 'purchase_date',
    type: 'timestamptz',
    default: () => 'now()',
  })
  purchaseDate!: Date;

  @Column({ type: 'varchar', length: 50, default: 'DRAFT' })
  status!: 'DRAFT' | 'RECEIVED' | 'CANCELLED';

  @Column({ name: 'total_items', type: 'int', default: 0 })
  totalItems!: number;

  @Column({
    name: 'subtotal',
    type: 'decimal',
    precision: 14,
    scale: 2,
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string | number) => Number(value),
    },
  })
  subtotal!: number;

  @Column({
    name: 'total_amount',
    type: 'decimal',
    precision: 14,
    scale: 2,
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string | number) => Number(value),
    },
  })
  totalAmount!: number;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ name: 'received_at', type: 'timestamptz', nullable: true })
  receivedAt!: Date | null;

  @Column({ name: 'received_by', type: 'uuid', nullable: true })
  receivedBy!: string | null;

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

  @ManyToOne(() => Supplier, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'supplier_id' })
  supplier!: Supplier;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'received_by' })
  receiver!: User | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  creator!: User | null;

  @OneToMany(() => PurchaseItem, (item) => item.purchase, { cascade: true })
  items!: PurchaseItem[];
}
