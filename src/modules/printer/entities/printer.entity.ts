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

export type PrinterType = 'RECEIPT' | 'KITCHEN' | 'BAR';
export type PrinterConnectionType = 'BLUETOOTH' | 'NETWORK' | 'USB';
export type PrinterPaperSize = '58mm' | '80mm';
export type PrinterStatus = 'ACTIVE' | 'INACTIVE';

@Entity('printers')
@Index(['tenantId'])
@Index(['outletId'])
@Index(['outletId', 'type'])
export class Printer {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'outlet_id', type: 'uuid' })
  outletId!: string;

  @Column({ length: 100 })
  name!: string;

  @Column({ length: 20 })
  type!: PrinterType;

  @Column({ name: 'connection_type', length: 20 })
  connectionType!: PrinterConnectionType;

  @Column({ name: 'paper_size', length: 10, default: '58mm' })
  paperSize!: PrinterPaperSize;

  @Column({ name: 'ip_address', length: 45, nullable: true })
  ipAddress!: string | null;

  @Column({ type: 'int', nullable: true, default: 9100 })
  port!: number | null;

  @Column({ name: 'bluetooth_mac', length: 100, nullable: true })
  bluetoothMac!: string | null;

  @Column({ name: 'is_default', default: false })
  isDefault!: boolean;

  @Column({ length: 20, default: 'ACTIVE' })
  status!: PrinterStatus;

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
}
