import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment } from './entities/payment.entity';
import { Transaction } from './entities/transaction.entity';
import { Order } from '../order/entities/order.entity';
import { Recipe } from '../recipe/entities/recipe.entity';
import { InventoryStock } from '../inventory/entities/inventory-stock.entity';
import { InventoryMovement } from '../inventory/entities/inventory-movement.entity';
import { AuditModule } from '../audit/audit.module';
import { PaymentService } from './services/payment.service';
import { PaymentController } from './controllers/payment.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Payment,
      Transaction,
      Order,
      Recipe,
      InventoryStock,
      InventoryMovement,
    ]),
    AuditModule,
  ],
  controllers: [PaymentController],
  providers: [PaymentService],
  exports: [PaymentService],
})
export class PaymentModule {}
