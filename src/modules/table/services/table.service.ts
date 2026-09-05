import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Table } from '../entities/table.entity';
import { Outlet } from '../../outlet/outlet.entity';
import { AuditService } from '../../audit/audit.service';
import {
  CreateTableDto,
  QueryTableDto,
  UpdateTableDto,
} from '../dto/table.dto';

@Injectable()
export class TableService {
  constructor(
    @InjectRepository(Table)
    private readonly tableRepository: Repository<Table>,
    @InjectRepository(Outlet)
    private readonly outletRepository: Repository<Outlet>,
    private readonly audit: AuditService,
  ) {}

  async findAll(tenantId: string, query: QueryTableDto) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit =
      query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 50;
    const skip = (page - 1) * limit;

    const qb = this.tableRepository
      .createQueryBuilder('table')
      .leftJoinAndSelect('table.outlet', 'outlet')
      .where('table.tenantId = :tenantId', { tenantId });

    if (query.outletId) {
      qb.andWhere('table.outletId = :outletId', { outletId: query.outletId });
    }

    if (query.status) {
      qb.andWhere('table.status = :status', { status: query.status });
    }

    if (query.search) {
      qb.andWhere('LOWER(table.name) LIKE LOWER(:search)', {
        search: `%${query.search}%`,
      });
    }

    qb.orderBy('table.name', 'ASC');
    qb.skip(skip).take(limit);

    const [items, total] = await qb.getManyAndCount();

    return {
      data: items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(tenantId: string, id: string) {
    const table = await this.tableRepository.findOne({
      where: { id, tenantId },
      relations: { outlet: true },
    });

    if (!table) {
      throw new NotFoundException({
        success: false,
        message: 'Table not found',
        code: 'TABLE_NOT_FOUND',
      });
    }

    return table;
  }

  async create(tenantId: string, userId: string, dto: CreateTableDto) {
    const outlet = await this.outletRepository.findOne({
      where: { id: dto.outletId, tenantId },
    });

    if (!outlet) {
      throw new BadRequestException({
        success: false,
        message: 'Outlet not found or does not belong to this tenant',
        code: 'INVALID_OUTLET',
      });
    }

    const existing = await this.tableRepository.findOne({
      where: {
        tenantId,
        outletId: dto.outletId,
        name: dto.name,
      },
    });

    if (existing) {
      throw new ConflictException({
        success: false,
        message: `Table with name "${dto.name}" already exists in this outlet`,
        code: 'DUPLICATE_TABLE_NAME',
      });
    }

    const table = this.tableRepository.create({
      tenantId,
      outletId: dto.outletId,
      name: dto.name,
      capacity: dto.capacity ?? 4,
      status: dto.status ?? 'AVAILABLE',
    });

    const saved = await this.tableRepository.save(table);

    await this.audit.record({
      action: 'TABLE_CREATED',
      tenantId,
      actorType: 'USER',
      actorId: userId,
      metadata: {
        tableId: saved.id,
        tableName: saved.name,
        outletId: saved.outletId,
      },
    });

    return saved;
  }

  async update(
    tenantId: string,
    userId: string,
    id: string,
    dto: UpdateTableDto,
  ) {
    const table = await this.findById(tenantId, id);

    if (dto.name && dto.name !== table.name) {
      const duplicate = await this.tableRepository.findOne({
        where: {
          tenantId,
          outletId: table.outletId,
          name: dto.name,
        },
      });

      if (duplicate && duplicate.id !== table.id) {
        throw new ConflictException({
          success: false,
          message: `Table with name "${dto.name}" already exists in this outlet`,
          code: 'DUPLICATE_TABLE_NAME',
        });
      }
      table.name = dto.name;
    }

    if (dto.capacity !== undefined) {
      table.capacity = dto.capacity;
    }

    if (dto.status !== undefined) {
      table.status = dto.status;
    }

    const updated = await this.tableRepository.save(table);

    await this.audit.record({
      action: 'TABLE_UPDATED',
      tenantId,
      actorType: 'USER',
      actorId: userId,
      metadata: {
        tableId: updated.id,
        tableName: updated.name,
        status: updated.status,
      },
    });

    return updated;
  }

  async delete(tenantId: string, userId: string, id: string) {
    const table = await this.findById(tenantId, id);

    if (table.status === 'OCCUPIED') {
      throw new BadRequestException({
        success: false,
        message:
          'Cannot delete an occupied table. Complete or void active orders first.',
        code: 'TABLE_OCCUPIED',
      });
    }

    await this.tableRepository.remove(table);

    await this.audit.record({
      action: 'TABLE_DELETED',
      tenantId,
      actorType: 'USER',
      actorId: userId,
      metadata: {
        tableId: id,
        tableName: table.name,
      },
    });

    return {
      success: true,
      message: 'Table deleted successfully',
    };
  }
}
