import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Purchase } from './entities/purchase.entity';
import { PurchaseItem } from './entities/purchase-item.entity';
import { PurchasePayment } from './entities/purchase-payment.entity';
import { Outlet } from '../outlet/outlet.entity';
import { Supplier } from '../supplier/entities/supplier.entity';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { InventoryStock } from '../inventory/entities/inventory-stock.entity';
import { InventoryMovement } from '../inventory/entities/inventory-movement.entity';
import { Packaging } from '../packaging/entities/packaging.entity';
import { PurchaseService } from './services/purchase.service';
import { PurchaseController } from './controllers/purchase.controller';
import { AuditModule } from '../audit/audit.module';
import { FinanceModule } from '../finance/finance.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Purchase,
      PurchaseItem,
      PurchasePayment,
      Outlet,
      Supplier,
      InventoryItem,
      InventoryStock,
      InventoryMovement,
      Packaging,
    ]),
    AuditModule,
    FinanceModule,
  ],
  controllers: [PurchaseController],
  providers: [PurchaseService],
  exports: [PurchaseService],
})
export class PurchaseModule {}
