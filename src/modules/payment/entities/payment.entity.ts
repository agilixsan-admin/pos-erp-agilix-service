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
import { Order } from '../../order/entities/order.entity';
import { User } from '../../user/user.entity';

@Entity('payments')
@Index(['orderId'])
@Index(['tenantId', 'gatewayReference'])
@Index(['tenantId', 'status'])
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'outlet_id', type: 'uuid' })
  outletId!: string;

  @Column({ name: 'order_id', type: 'uuid' })
  orderId!: string;

  @Column({ name: 'payment_method' })
  paymentMethod!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount!: number;

  @Column({
    name: 'change_amount',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
  })
  changeAmount!: number;

  @Column({ default: 'SUCCESS' })
  status!: string;

  @Column({ name: 'reference_number', type: 'varchar', nullable: true })
  referenceNumber!: string | null;

  @Column({ name: 'qr_string', type: 'text', nullable: true })
  qrString!: string | null;

  @Column({ name: 'qr_url', type: 'text', nullable: true })
  qrUrl!: string | null;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt!: Date | null;

  @Column({
    name: 'gateway_provider',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  gatewayProvider!: string | null;

  @Column({
    name: 'gateway_reference',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  gatewayReference!: string | null;

  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true })
  paidAt!: Date | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @ManyToOne(() => Tenant, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: Tenant;

  @ManyToOne(() => Outlet, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'outlet_id' })
  outlet!: Outlet;

  @ManyToOne(() => Order, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'order_id' })
  order!: Order;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'created_by' })
  creator!: User | null;
}
