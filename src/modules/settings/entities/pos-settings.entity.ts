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

export type DiscountType = 'PERCENTAGE' | 'FIXED';

@Entity('pos_settings')
@Index(['tenantId'])
@Index(['outletId'])
export class PosSettings {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'outlet_id', type: 'uuid', nullable: true })
  outletId!: string | null;

  @Column({ name: 'tax_enabled', default: false })
  taxEnabled!: boolean;

  @Column({
    name: 'tax_rate',
    type: 'numeric',
    precision: 5,
    scale: 2,
    default: 0,
  })
  taxRate!: number;

  @Column({ name: 'tax_name', length: 50, default: 'PB1' })
  taxName!: string;

  @Column({ name: 'discount_enabled', default: false })
  discountEnabled!: boolean;

  @Column({ name: 'discount_type', length: 20, default: 'PERCENTAGE' })
  discountType!: DiscountType;

  @Column({
    name: 'discount_value',
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
  })
  discountValue!: number;

  @Column({ name: 'cash_enabled', default: true })
  cashEnabled!: boolean;

  @Column({ name: 'qris_enabled', default: true })
  qrisEnabled!: boolean;

  @Column({ name: 'bill_logo_url', length: 500, nullable: true })
  billLogoUrl!: string | null;

  @Column({
    name: 'bill_footer_text',
    type: 'text',
    nullable: true,
    default: 'Terima kasih atas kunjungan Anda!',
  })
  billFooterText!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @ManyToOne(() => Tenant, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: Tenant;

  @ManyToOne(() => Outlet, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'outlet_id' })
  outlet!: Outlet | null;
}
