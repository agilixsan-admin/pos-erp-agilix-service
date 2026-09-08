import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PosSettings } from './entities/pos-settings.entity';
import { Tax } from './entities/tax.entity';
import { Discount } from './entities/discount.entity';
import { Outlet } from '../outlet/outlet.entity';
import { Product } from '../product/entities/product.entity';
import { AuditModule } from '../audit/audit.module';
import { SettingsService } from './services/settings.service';
import { TaxService } from './services/tax.service';
import { DiscountService } from './services/discount.service';
import { SettingsController } from './controllers/settings.controller';
import { TaxController } from './controllers/tax.controller';
import { DiscountController } from './controllers/discount.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([PosSettings, Tax, Discount, Outlet, Product]),
    AuditModule,
  ],
  controllers: [SettingsController, TaxController, DiscountController],
  providers: [SettingsService, TaxService, DiscountService],
  exports: [SettingsService, TaxService, DiscountService],
})
export class SettingsModule {}
