import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PosSettings } from './entities/pos-settings.entity';
import { Outlet } from '../outlet/outlet.entity';
import { AuditModule } from '../audit/audit.module';
import { SettingsService } from './services/settings.service';
import { SettingsController } from './controllers/settings.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PosSettings, Outlet]), AuditModule],
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
