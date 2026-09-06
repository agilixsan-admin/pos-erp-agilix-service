import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Outlet } from './outlet.entity';
import { OutletService } from './outlet.service';
import { OutletController } from './controllers/outlet.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [TypeOrmModule.forFeature([Outlet]), AuditModule],
  controllers: [OutletController],
  providers: [OutletService],
  exports: [OutletService, TypeOrmModule],
})
export class OutletModule {}
