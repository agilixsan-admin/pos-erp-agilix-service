import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Supplier } from '../entities/supplier.entity';
import { AuditService } from '../../audit/audit.service';
import {
  CreateSupplierDto,
  QuerySupplierDto,
  UpdateSupplierDto,
} from '../dto/supplier.dto';

export interface PaginatedSuppliers {
  data: Supplier[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

@Injectable()
export class SupplierService {
  constructor(
    @InjectRepository(Supplier)
    private readonly supplierRepository: Repository<Supplier>,
    private readonly audit: AuditService,
  ) {}

  /**
   * Get list of suppliers for a tenant with pagination, search, and status filter
   */
  async findAll(
    tenantId: string,
    query: QuerySupplierDto,
  ): Promise<PaginatedSuppliers> {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit =
      query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20;
    const skip = (page - 1) * limit;

    const qb = this.supplierRepository
      .createQueryBuilder('supplier')
      .where('supplier.tenantId = :tenantId', { tenantId });

    if (query.status) {
      qb.andWhere('supplier.status = :status', { status: query.status });
    }

    if (query.search) {
      qb.andWhere(
        '(LOWER(supplier.name) LIKE LOWER(:search) OR LOWER(supplier.code) LIKE LOWER(:search) OR LOWER(supplier.contactPerson) LIKE LOWER(:search) OR LOWER(supplier.phone) LIKE LOWER(:search) OR LOWER(supplier.email) LIKE LOWER(:search))',
        { search: `%${query.search}%` },
      );
    }

    qb.orderBy('supplier.createdAt', 'DESC');
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

  /**
   * Get single supplier detail by ID
   */
  async findById(tenantId: string, id: string): Promise<Supplier> {
    const supplier = await this.supplierRepository.findOne({
      where: { id, tenantId },
    });

    if (!supplier) {
      throw new NotFoundException({
        success: false,
        message: 'Supplier not found',
        code: 'SUPPLIER_NOT_FOUND',
      });
    }

    return supplier;
  }

  /**
   * Create a new supplier
   */
  async create(
    tenantId: string,
    actorId: string,
    dto: CreateSupplierDto,
  ): Promise<Supplier> {
    const supplier = this.supplierRepository.create({
      tenantId,
      name: dto.name,
      code: dto.code ?? null,
      contactPerson: dto.contactPerson ?? null,
      phone: dto.phone ?? null,
      email: dto.email ?? null,
      address: dto.address ?? null,
      city: dto.city ?? null,
      province: dto.province ?? null,
      postalCode: dto.postalCode ?? null,
      notes: dto.notes ?? null,
      status: dto.status ?? 'ACTIVE',
    });

    const saved = await this.supplierRepository.save(supplier);

    await this.audit.record({
      action: 'SUPPLIER_CREATED',
      tenantId,
      actorType: 'USER',
      actorId,
      metadata: {
        supplierId: saved.id,
        name: saved.name,
        code: saved.code,
        contactPerson: saved.contactPerson,
      },
    });

    return saved;
  }

  /**
   * Update an existing supplier
   */
  async update(
    tenantId: string,
    id: string,
    actorId: string,
    dto: UpdateSupplierDto,
  ): Promise<Supplier> {
    const supplier = await this.findById(tenantId, id);

    if (dto.name !== undefined) {
      supplier.name = dto.name;
    }
    if (dto.code !== undefined) {
      supplier.code = dto.code ?? null;
    }
    if (dto.contactPerson !== undefined) {
      supplier.contactPerson = dto.contactPerson ?? null;
    }
    if (dto.phone !== undefined) {
      supplier.phone = dto.phone ?? null;
    }
    if (dto.email !== undefined) {
      supplier.email = dto.email ?? null;
    }
    if (dto.address !== undefined) {
      supplier.address = dto.address ?? null;
    }
    if (dto.city !== undefined) {
      supplier.city = dto.city ?? null;
    }
    if (dto.province !== undefined) {
      supplier.province = dto.province ?? null;
    }
    if (dto.postalCode !== undefined) {
      supplier.postalCode = dto.postalCode ?? null;
    }
    if (dto.notes !== undefined) {
      supplier.notes = dto.notes ?? null;
    }
    if (dto.status !== undefined) {
      supplier.status = dto.status;
    }

    const updated = await this.supplierRepository.save(supplier);

    await this.audit.record({
      action: 'SUPPLIER_UPDATED',
      tenantId,
      actorType: 'USER',
      actorId,
      metadata: {
        supplierId: updated.id,
        updatedFields: Object.keys(dto),
      },
    });

    return updated;
  }

  /**
   * Soft delete a supplier
   */
  async delete(
    tenantId: string,
    id: string,
    actorId: string,
  ): Promise<{ success: boolean; message: string }> {
    const supplier = await this.findById(tenantId, id);

    await this.supplierRepository.softRemove(supplier);

    await this.audit.record({
      action: 'SUPPLIER_DELETED',
      tenantId,
      actorType: 'USER',
      actorId,
      metadata: {
        supplierId: supplier.id,
        name: supplier.name,
      },
    });

    return {
      success: true,
      message: 'Supplier deleted successfully',
    };
  }
}

