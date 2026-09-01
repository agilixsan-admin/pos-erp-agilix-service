import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryItem } from './entities/inventory-item.entity';
import { InventoryStock } from './entities/inventory-stock.entity';
import { InventoryMovement } from './entities/inventory-movement.entity';
import { ReasonCategory } from './entities/reason-category.entity';
import { Outlet } from '../outlet/outlet.entity';
import { AuditModule } from '../audit/audit.module';
import { InventoryService } from './services/inventory.service';
import { InventoryController } from './controllers/inventory.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InventoryItem,
      InventoryStock,
      InventoryMovement,
      ReasonCategory,
      Outlet,
    ]),
    AuditModule,
  ],
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
