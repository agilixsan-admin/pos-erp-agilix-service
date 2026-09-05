import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Printer } from './entities/printer.entity';
import { Outlet } from '../outlet/outlet.entity';
import { Order } from '../order/entities/order.entity';
import { Payment } from '../payment/entities/payment.entity';
import { AuditModule } from '../audit/audit.module';
import { SettingsModule } from '../settings/settings.module';
import { PrinterService } from './services/printer.service';
import { EscPosBuilderService } from './services/escpos-builder.service';
import { NetworkPrinterDriver } from './services/network-printer.driver';
import { PrinterController } from './controllers/printer.controller';
import { OrderPrintController } from './controllers/order-print.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Printer, Outlet, Order, Payment]),
    AuditModule,
    SettingsModule,
  ],
  controllers: [PrinterController, OrderPrintController],
  providers: [PrinterService, EscPosBuilderService, NetworkPrinterDriver],
  exports: [PrinterService, EscPosBuilderService, NetworkPrinterDriver],
})
export class PrinterModule {}
