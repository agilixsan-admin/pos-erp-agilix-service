import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment } from './entities/payment.entity';
import { Transaction } from './entities/transaction.entity';
import { Order } from '../order/entities/order.entity';
import { Recipe } from '../recipe/entities/recipe.entity';
import { InventoryStock } from '../inventory/entities/inventory-stock.entity';
import { InventoryMovement } from '../inventory/entities/inventory-movement.entity';
import { Table } from '../table/entities/table.entity';
import { Packaging } from '../packaging/entities/packaging.entity';
import { AuditModule } from '../audit/audit.module';
import { SettingsModule } from '../settings/settings.module';
import { PaymentService } from './services/payment.service';
import { PaymentController } from './controllers/payment.controller';
import { PaymentWebhookController } from './controllers/payment-webhook.controller';
import { MockQrisProvider } from './providers/mock-qris.provider';
import { MidtransQrisProvider } from './providers/midtrans-qris.provider';
import { QRIS_PROVIDER_TOKEN } from './interfaces/qris-provider.interface';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Payment,
      Transaction,
      Order,
      Recipe,
      InventoryStock,
      InventoryMovement,
      Table,
      Packaging,
    ]),
    AuditModule,
    SettingsModule,
  ],
  controllers: [PaymentController, PaymentWebhookController],
  providers: [
    PaymentService,
    MockQrisProvider,
    MidtransQrisProvider,
    {
      provide: QRIS_PROVIDER_TOKEN,
      useFactory: (config: ConfigService) => {
        const provider = config.get<string>('payment.qrisProvider') ?? 'mock';
        if (provider === 'midtrans') {
          return new MidtransQrisProvider(config);
        }
        return new MockQrisProvider();
      },
      inject: [ConfigService],
    },
  ],
  exports: [PaymentService, QRIS_PROVIDER_TOKEN],
})
export class PaymentModule {}
