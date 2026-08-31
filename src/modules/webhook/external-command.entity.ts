import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Tenant } from '../tenant/tenant.entity';

@Entity('external_commands')
@Index(['eventId'], { unique: true })
export class ExternalCommand {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'event_id' })
  eventId!: string;

  @Column({ name: 'event_name' })
  eventName!: string;

  @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
  tenantId!: string | null;

  @Column({ type: 'jsonb' })
  payload!: Record<string, unknown>;

  @Column({ default: 'PROCESSED' })
  status!: string;

  @CreateDateColumn({ name: 'received_at', type: 'timestamptz' })
  receivedAt!: Date;

  @Column({ name: 'processed_at', type: 'timestamptz', nullable: true })
  processedAt!: Date | null;

  @ManyToOne(() => Tenant, (tenant) => tenant.externalCommands, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: Tenant | null;
}
