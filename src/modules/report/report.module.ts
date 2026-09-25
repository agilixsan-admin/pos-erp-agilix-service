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
import { Recipe } from '../recipe/entities/recipe.entity';
import { PosShift } from '../shift/entities/pos-shift.entity';
import { Expense } from '../finance/entities/expense.entity';
import { FinancialAccount } from '../finance/entities/financial-account.entity';
import { FixedAsset } from '../finance/entities/fixed-asset.entity';
import { CapitalTransaction } from '../finance/entities/capital-transaction.entity';
import { FinanceModule } from '../finance/finance.module';

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
      Recipe,
      PosShift,
      Expense,
      FinancialAccount,
      FixedAsset,
      CapitalTransaction,
    ]),
    FinanceModule,
  ],
  controllers: [ReportController],
  providers: [ReportService],
  exports: [ReportService],
})
export class ReportModule {}
