import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Tenant } from '../../tenant/tenant.entity';
import { Outlet } from '../../outlet/outlet.entity';
import { Printer } from './printer.entity';
import { Category } from '../../product/entities/category.entity';

@Entity('printer_category_routings')
@Index(['tenantId'])
@Index(['outletId'])
@Index(['printerId'])
@Index(['categoryId'])
@Unique(['outletId', 'categoryId'])
export class PrinterCategoryRouting {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'outlet_id', type: 'uuid' })
  outletId!: string;

  @Column({ name: 'printer_id', type: 'uuid' })
  printerId!: string;

  @Column({ name: 'category_id', type: 'uuid' })
  categoryId!: string;

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

  @ManyToOne(() => Printer, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'printer_id' })
  printer!: Printer;

  @ManyToOne(() => Category, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'category_id' })
  category!: Category;
}
