import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StockOpname } from './entities/stock-opname.entity';
import { StockOpnameItem } from './entities/stock-opname-item.entity';
import { Outlet } from '../outlet/outlet.entity';
import { InventoryCategory } from '../inventory/entities/inventory-category.entity';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { InventoryStock } from '../inventory/entities/inventory-stock.entity';
import { AuditModule } from '../audit/audit.module';
import { StockOpnameService } from './services/stock-opname.service';
import { StockOpnameController } from './controllers/stock-opname.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      StockOpname,
      StockOpnameItem,
      Outlet,
      InventoryCategory,
      InventoryItem,
      InventoryStock,
    ]),
    AuditModule,
  ],
  controllers: [StockOpnameController],
  providers: [StockOpnameService],
  exports: [StockOpnameService],
})
export class StockOpnameModule {}
