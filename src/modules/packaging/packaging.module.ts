import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Packaging } from './entities/packaging.entity';
import { PackagingService } from './services/packaging.service';
import { PackagingController } from './controllers/packaging.controller';
import { Outlet } from '../outlet/outlet.entity';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Packaging, Outlet, InventoryItem]),
    AuditModule,
  ],
  controllers: [PackagingController],
  providers: [PackagingService],
  exports: [PackagingService, TypeOrmModule],
})
export class PackagingModule {}
