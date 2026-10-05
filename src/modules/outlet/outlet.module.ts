import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Outlet } from './outlet.entity';
import { Tenant } from '../tenant/tenant.entity';
import { OutletService } from './outlet.service';
import { OutletController } from './controllers/outlet.controller';
import { AuditModule } from '../audit/audit.module';
import { FinanceModule } from '../finance/finance.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Outlet, Tenant]),
    AuditModule,
    FinanceModule,
  ],
  controllers: [OutletController],
  providers: [OutletService],
  exports: [OutletService, TypeOrmModule],
})
export class OutletModule {}
