import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from './tenant.entity';
import { TenantStatus } from './tenant-status.enum';

@Injectable()
export class TenantService {
  constructor(
    @InjectRepository(Tenant) private readonly tenants: Repository<Tenant>,
  ) {}

  findById(id: string) {
    return this.tenants.findOne({ where: { id } });
  }

  findByIdWithSecret(id: string) {
    return this.tenants
      .createQueryBuilder('tenant')
      .addSelect('tenant.consoleApiKey')
      .where('tenant.id = :id', { id })
      .getOne();
  }

  async setStatus(id: string, status: TenantStatus) {
    await this.tenants.update({ id }, { status });
    return this.findById(id);
  }
}
