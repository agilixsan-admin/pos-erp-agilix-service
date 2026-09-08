import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryItem } from './entities/inventory-item.entity';
import { InventoryCategory } from './entities/inventory-category.entity';
import { InventoryStock } from './entities/inventory-stock.entity';
import { InventoryMovement } from './entities/inventory-movement.entity';
import { ReasonCategory } from './entities/reason-category.entity';
import { StockAdjustment } from './entities/stock-adjustment.entity';
import { Outlet } from '../outlet/outlet.entity';
import { AuditModule } from '../audit/audit.module';
import { StorageModule } from '../storage/storage.module';
import { InventoryService } from './services/inventory.service';
import { InventoryController } from './controllers/inventory.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InventoryItem,
      InventoryCategory,
      InventoryStock,
      InventoryMovement,
      ReasonCategory,
      StockAdjustment,
      Outlet,
    ]),
    AuditModule,
    StorageModule,
  ],
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
