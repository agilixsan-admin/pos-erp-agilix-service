import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Table } from './entities/table.entity';
import { Outlet } from '../outlet/outlet.entity';
import { AuditModule } from '../audit/audit.module';
import { TableService } from './services/table.service';
import { TableController } from './controllers/table.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Table, Outlet]), AuditModule],
  controllers: [TableController],
  providers: [TableService],
  exports: [TableService, TypeOrmModule],
})
export class TableModule {}
