import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { Void } from './entities/void.entity';
import { Outlet } from '../outlet/outlet.entity';
import { ProductVariant } from '../product/entities/product-variant.entity';
import { AuditLog } from '../audit/audit-log.entity';
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
      AuditLog,
    ]),
  ],
  controllers: [OrderController],
  providers: [OrderService],
  exports: [OrderService],
})
export class OrderModule {}

