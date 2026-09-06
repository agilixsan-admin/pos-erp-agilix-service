import 'dotenv/config';
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Tenant } from '../modules/tenant/tenant.entity';
import { Outlet } from '../modules/outlet/outlet.entity';
import { User } from '../modules/user/user.entity';
import { Role } from '../modules/rbac/role.entity';
import { ExternalCommand } from '../modules/webhook/external-command.entity';
import { AuditLog } from '../modules/audit/audit-log.entity';
import { Category } from '../modules/product/entities/category.entity';
import { Product } from '../modules/product/entities/product.entity';
import { ProductVariant } from '../modules/product/entities/product-variant.entity';
import { InventoryItem } from '../modules/inventory/entities/inventory-item.entity';
import { InventoryStock } from '../modules/inventory/entities/inventory-stock.entity';
import { ReasonCategory } from '../modules/inventory/entities/reason-category.entity';
import { InventoryMovement } from '../modules/inventory/entities/inventory-movement.entity';
import { Recipe } from '../modules/recipe/entities/recipe.entity';
import { Order } from '../modules/order/entities/order.entity';
import { OrderItem } from '../modules/order/entities/order-item.entity';
import { Void } from '../modules/order/entities/void.entity';
import { Payment } from '../modules/payment/entities/payment.entity';
import { Transaction } from '../modules/payment/entities/transaction.entity';
import { Table } from '../modules/table/entities/table.entity';
import { Printer } from '../modules/printer/entities/printer.entity';
import { PosSettings } from '../modules/settings/entities/pos-settings.entity';
import { Packaging } from '../modules/packaging/entities/packaging.entity';
import { ALL_MIGRATIONS } from './migrations';

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USERNAME ?? 'postgres',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME ?? 'aglix_pos',
  ssl: process.env.DB_SSL === 'true',
  logging: process.env.DB_LOGGING === 'true',
  entities: [
    Tenant,
    Outlet,
    User,
    Role,
    ExternalCommand,
    AuditLog,
    Category,
    Product,
    ProductVariant,
    InventoryItem,
    InventoryStock,
    ReasonCategory,
    InventoryMovement,
    Recipe,
    Order,
    OrderItem,
    Void,
    Payment,
    Transaction,
    Table,
    Printer,
    PosSettings,
    Packaging,
  ],
  migrations: ALL_MIGRATIONS,
  synchronize: false,
});
