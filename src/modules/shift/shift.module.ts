import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PosShift } from './entities/pos-shift.entity';
import { PettyCashTransaction } from './entities/petty-cash-transaction.entity';
import { Order } from '../order/entities/order.entity';
import { Payment } from '../payment/entities/payment.entity';
import { ShiftService } from './shift.service';
import { ShiftController } from './shift.controller';
import { FinanceModule } from '../finance/finance.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PosShift, PettyCashTransaction, Order, Payment]),
    FinanceModule,
    AuditModule,
  ],
  providers: [ShiftService],
  controllers: [ShiftController],
  exports: [ShiftService],
})
export class ShiftModule {}
