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

export type TaxType = 'INCLUSIVE' | 'EXCLUSIVE';
export type TaxStatus = 'ACTIVE' | 'INACTIVE';

@Entity('taxes')
@Index(['tenantId'])
@Index(['outletId'])
@Index(['status'])
export class Tax {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'outlet_id', type: 'uuid', nullable: true })
  outletId!: string | null;

  @Column({ name: 'name', type: 'varchar', length: 100 })
  name!: string;

  @Column({ name: 'description', type: 'varchar', length: 255, nullable: true })
  description!: string | null;

  @Column({
    name: 'rate',
    type: 'numeric',
    precision: 5,
    scale: 2,
    default: 0,
  })
  rate!: number;

  @Column({
    name: 'type',
    type: 'varchar',
    length: 20,
    default: 'EXCLUSIVE',
  })
  type!: TaxType;

  @Column({
    name: 'status',
    type: 'varchar',
    length: 20,
    default: 'ACTIVE',
  })
  status!: TaxStatus;

  @Column({ name: 'is_global', type: 'boolean', default: false })
  isGlobal!: boolean;

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
