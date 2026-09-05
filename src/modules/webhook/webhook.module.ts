import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExternalCommand } from './external-command.entity';
import { Tenant } from '../tenant/tenant.entity';
import { Outlet } from '../outlet/outlet.entity';
import { PosSettings } from '../settings/entities/pos-settings.entity';
import { AuditModule } from '../audit/audit.module';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ExternalCommand, Tenant, Outlet, PosSettings]),
    AuditModule,
  ],
  controllers: [WebhookController],
  providers: [WebhookService],
})
export class WebhookModule {}
