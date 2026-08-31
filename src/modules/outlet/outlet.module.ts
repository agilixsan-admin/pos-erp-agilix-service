import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Outlet } from './outlet.entity';
import { OutletService } from './outlet.service';

@Module({
  imports: [TypeOrmModule.forFeature([Outlet])],
  providers: [OutletService],
  exports: [OutletService, TypeOrmModule],
})
export class OutletModule {}
