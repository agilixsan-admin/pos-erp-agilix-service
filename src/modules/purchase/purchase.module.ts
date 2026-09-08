import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Purchase } from './entities/purchase.entity';
import { PurchaseItem } from './entities/purchase-item.entity';
import { Outlet } from '../outlet/outlet.entity';
import { Supplier } from '../supplier/entities/supplier.entity';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { InventoryStock } from '../inventory/entities/inventory-stock.entity';
import { InventoryMovement } from '../inventory/entities/inventory-movement.entity';
import { Packaging } from '../packaging/entities/packaging.entity';
import { PurchaseService } from './services/purchase.service';
import { PurchaseController } from './controllers/purchase.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Purchase,
      PurchaseItem,
      Outlet,
      Supplier,
      InventoryItem,
      InventoryStock,
      InventoryMovement,
      Packaging,
    ]),
    AuditModule,
  ],
  controllers: [PurchaseController],
  providers: [PurchaseService],
  exports: [PurchaseService],
})
export class PurchaseModule {}
