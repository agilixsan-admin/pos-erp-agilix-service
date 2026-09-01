import 'dotenv/config';
import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import configuration from './config/configuration';
import { configurationValidationSchema } from './config/validation';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './health.controller';
import { TenantModule } from './modules/tenant/tenant.module';
import { OutletModule } from './modules/outlet/outlet.module';
import { UserModule } from './modules/user/user.module';
import { AuthModule } from './modules/auth/auth.module';
import { RbacModule } from './modules/rbac/rbac.module';
import { AuditModule } from './modules/audit/audit.module';
import { WebhookModule } from './modules/webhook/webhook.module';
import { ProductModule } from './modules/product/product.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { RecipeModule } from './modules/recipe/recipe.module';
import { OrderModule } from './modules/order/order.module';
import { PaymentModule } from './modules/payment/payment.module';
import { ReportModule } from './modules/report/report.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { TenantStatusGuard } from './common/guards/tenant-status.guard';
import { PermissionGuard } from './common/guards/permission.guard';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

const isProductionOrDevDb =
  Boolean(process.env.DB_HOST) && process.env.NODE_ENV !== 'test';

const conditionalModules = isProductionOrDevDb
  ? [
      DatabaseModule,
      TenantModule,
      OutletModule,
      UserModule,
      AuthModule,
      RbacModule,
      AuditModule,
      WebhookModule,
      ProductModule,
      InventoryModule,
      RecipeModule,
      OrderModule,
      PaymentModule,
      ReportModule,
    ]
  : [];

const conditionalProviders = isProductionOrDevDb
  ? [
      { provide: APP_GUARD, useClass: JwtAuthGuard },
      { provide: APP_GUARD, useClass: TenantStatusGuard },
      { provide: APP_GUARD, useClass: PermissionGuard },
      { provide: APP_FILTER, useClass: HttpExceptionFilter },
    ]
  : [];

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [configuration],
      validationSchema: configurationValidationSchema,
    }),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000, // 1 minute window
        limit: 120, // 120 requests per minute
      },
    ]),
    ...conditionalModules,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    ...conditionalProviders,
  ],
})
export class AppModule {}
