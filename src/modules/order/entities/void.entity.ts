import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Tenant } from '../../tenant/tenant.entity';
import { Outlet } from '../../outlet/outlet.entity';
import { Order } from './order.entity';
import { OrderItem } from './order-item.entity';
import { ReasonCategory } from '../../inventory/entities/reason-category.entity';
import { User } from '../../user/user.entity';

@Entity('voids')
export class Void {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'outlet_id', type: 'uuid' })
  outletId!: string;

  @Column({ name: 'order_id', type: 'uuid' })
  orderId!: string;

  @Column({ name: 'order_item_id', type: 'uuid', nullable: true })
  orderItemId!: string | null;

  @Column({ name: 'reason_category_id', type: 'uuid', nullable: true })
  reasonCategoryId!: string | null;

  @Column()
  reason!: string;

  @Column({ name: 'voided_by', type: 'uuid', nullable: true })
  voidedBy!: string | null;

  @CreateDateColumn({ name: 'voided_at', type: 'timestamptz' })
  voidedAt!: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @ManyToOne(() => Tenant, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: Tenant;

  @ManyToOne(() => Outlet, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'outlet_id' })
  outlet!: Outlet;

  @ManyToOne(() => Order, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'order_id' })
  order!: Order;

  @ManyToOne(() => OrderItem, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'order_item_id' })
  orderItem!: OrderItem | null;

  @ManyToOne(() => ReasonCategory, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'reason_category_id' })
  reasonCategory!: ReasonCategory | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'voided_by' })
  voider!: User | null;
}

