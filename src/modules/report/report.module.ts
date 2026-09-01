import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportService } from './report.service';
import { ReportController } from './controllers/report.controller';
import { Transaction } from '../payment/entities/transaction.entity';
import { Payment } from '../payment/entities/payment.entity';
import { Order } from '../order/entities/order.entity';
import { OrderItem } from '../order/entities/order-item.entity';
import { InventoryStock } from '../inventory/entities/inventory-stock.entity';
import { InventoryMovement } from '../inventory/entities/inventory-movement.entity';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Transaction,
      Payment,
      Order,
      OrderItem,
      InventoryStock,
      InventoryMovement,
      InventoryItem,
    ]),
  ],
  controllers: [ReportController],
  providers: [ReportService],
})
export class ReportModule {}
