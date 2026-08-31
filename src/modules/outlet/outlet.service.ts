import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Outlet } from './outlet.entity';

@Injectable()
export class OutletService {
  constructor(
    @InjectRepository(Outlet) private readonly outlets: Repository<Outlet>,
  ) {}

  findForTenant(tenantId: string, outletId: string) {
    return this.outlets.findOne({ where: { id: outletId, tenantId } });
  }
}
