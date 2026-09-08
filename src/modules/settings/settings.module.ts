import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PosSettings } from './entities/pos-settings.entity';
import { Tax } from './entities/tax.entity';
import { Outlet } from '../outlet/outlet.entity';
import { AuditModule } from '../audit/audit.module';
import { SettingsService } from './services/settings.service';
import { TaxService } from './services/tax.service';
import { SettingsController } from './controllers/settings.controller';
import { TaxController } from './controllers/tax.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PosSettings, Tax, Outlet]), AuditModule],
  controllers: [SettingsController, TaxController],
  providers: [SettingsService, TaxService],
  exports: [SettingsService, TaxService],
})
export class SettingsModule {}
