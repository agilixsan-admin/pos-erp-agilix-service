import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Outlet } from './outlet.entity';
import { AuditService } from '../audit/audit.service';
import { CreateOutletDto, UpdateOutletDto } from './dto/outlet.dto';

@Injectable()
export class OutletService {
  constructor(
    @InjectRepository(Outlet)
    private readonly outlets: Repository<Outlet>,
    private readonly auditService: AuditService,
  ) {}

  findForTenant(tenantId: string, outletId: string) {
    return this.outlets.findOne({ where: { id: outletId, tenantId } });
  }

  async findAll(tenantId: string): Promise<Outlet[]> {
    return this.outlets.find({
      where: { tenantId },
      order: { createdAt: 'ASC' },
    });
  }

  async findById(tenantId: string, id: string): Promise<Outlet> {
    const outlet = await this.outlets.findOne({
      where: { id, tenantId },
    });
    if (!outlet) {
      throw new NotFoundException({
        success: false,
        message: 'Outlet not found',
        code: 'OUTLET_NOT_FOUND',
      });
    }
    return outlet;
  }

  async create(
    tenantId: string,
    actorId: string,
    dto: CreateOutletDto,
  ): Promise<Outlet> {
    let code: string;

    if (dto.code) {
      code = dto.code.trim().toUpperCase();
      const existing = await this.outlets.findOne({
        where: { tenantId, code },
      });
      if (existing) {
        throw new ConflictException({
          success: false,
          message: 'Outlet code already exists for this tenant',
          code: 'OUTLET_CODE_EXISTS',
        });
      }
    } else {
      code = await this.generateUniqueCode(tenantId, dto.name);
    }

    const outlet = this.outlets.create({
      tenantId,
      name: dto.name.trim(),
      code,
      address: dto.address?.trim() ?? null,
      phone: dto.phone?.trim() ?? null,
      status: 'ACTIVE',
    });

    const saved = await this.outlets.save(outlet);

    await this.auditService.record({
      action: 'OUTLET_CREATED',
      tenantId,
      actorType: 'USER',
      actorId,
      metadata: {
        outletId: saved.id,
        name: saved.name,
        code: saved.code,
      },
    });

    return saved;
  }

  async update(
    tenantId: string,
    actorId: string,
    id: string,
    dto: UpdateOutletDto,
  ): Promise<Outlet> {
    const outlet = await this.findById(tenantId, id);

    if (dto.code && dto.code.trim().toUpperCase() !== outlet.code) {
      const code = dto.code.trim().toUpperCase();
      const duplicate = await this.outlets.findOne({
        where: { tenantId, code },
      });
      if (duplicate && duplicate.id !== id) {
        throw new ConflictException({
          success: false,
          message: 'Outlet code already exists for this tenant',
          code: 'OUTLET_CODE_EXISTS',
        });
      }
      outlet.code = code;
    }

    if (dto.name !== undefined) {
      outlet.name = dto.name.trim();
    }
    if (dto.address !== undefined) {
      outlet.address = dto.address ? dto.address.trim() : null;
    }
    if (dto.phone !== undefined) {
      outlet.phone = dto.phone ? dto.phone.trim() : null;
    }
    if (dto.status !== undefined) {
      outlet.status = dto.status;
    }

    const updated = await this.outlets.save(outlet);

    await this.auditService.record({
      action: 'OUTLET_UPDATED',
      tenantId,
      actorType: 'USER',
      actorId,
      metadata: {
        outletId: updated.id,
        name: updated.name,
        status: updated.status,
      },
    });

    return updated;
  }

  async delete(tenantId: string, actorId: string, id: string): Promise<void> {
    const outlet = await this.findById(tenantId, id);

    outlet.status = 'INACTIVE';
    await this.outlets.save(outlet);

    await this.auditService.record({
      action: 'OUTLET_DELETED',
      tenantId,
      actorType: 'USER',
      actorId,
      metadata: {
        outletId: id,
        name: outlet.name,
      },
    });
  }

  private async generateUniqueCode(
    tenantId: string,
    name: string,
  ): Promise<string> {
    const base =
      name
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, 6) || 'OUTLET';

    let candidate = base;
    let counter = 1;
    while (
      await this.outlets.findOne({ where: { tenantId, code: candidate } })
    ) {
      counter++;
      candidate = `${base}-${counter}`;
    }
    return candidate;
  }
}
