import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExternalCommand } from './external-command.entity';
import { Tenant } from '../tenant/tenant.entity';
import { Outlet } from '../outlet/outlet.entity';
import { AuditLog } from '../audit/audit-log.entity';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ExternalCommand, Tenant, Outlet, AuditLog]),
  ],
  controllers: [WebhookController],
  providers: [WebhookService],
})
export class WebhookModule {}
