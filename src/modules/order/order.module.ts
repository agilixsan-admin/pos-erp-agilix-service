import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { Void } from './entities/void.entity';
import { Outlet } from '../outlet/outlet.entity';
import { ProductVariant } from '../product/entities/product-variant.entity';
import { Table } from '../table/entities/table.entity';
import { AuditModule } from '../audit/audit.module';
import { SettingsModule } from '../settings/settings.module';
import { OrderService } from './services/order.service';
import { OrderController } from './controllers/order.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Order,
      OrderItem,
      Void,
      Outlet,
      ProductVariant,
      Table,
    ]),
    AuditModule,
    SettingsModule,
  ],

  controllers: [OrderController],
  providers: [OrderService],
  exports: [OrderService],
})
export class OrderModule {}
