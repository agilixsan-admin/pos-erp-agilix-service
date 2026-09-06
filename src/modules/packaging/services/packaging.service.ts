import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Packaging } from '../entities/packaging.entity';
import { Outlet } from '../../outlet/outlet.entity';
import { InventoryItem } from '../../inventory/entities/inventory-item.entity';
import { AuditService } from '../../audit/audit.service';
import {
  CreatePackagingDto,
  QueryPackagingDto,
  UpdatePackagingDto,
} from '../dto/packaging.dto';

export interface PaginatedPackagings {
  data: Packaging[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

@Injectable()
export class PackagingService {
  constructor(
    @InjectRepository(Packaging)
    private readonly packagings: Repository<Packaging>,
    @InjectRepository(Outlet)
    private readonly outlets: Repository<Outlet>,
    @InjectRepository(InventoryItem)
    private readonly inventoryItems: Repository<InventoryItem>,
    private readonly audit: AuditService,
  ) {}

  /**
   * Get list packaging scoped to tenant with pagination and optional filters
   */
  async findAll(
    tenantId: string,
    query: QueryPackagingDto,
  ): Promise<PaginatedPackagings> {
    const { page = 1, limit = 20, outletId, status, search } = query;

    const qb = this.packagings
      .createQueryBuilder('pkg')
      .leftJoinAndSelect('pkg.outlet', 'outlet')
      .leftJoinAndSelect('pkg.inventoryItem', 'inventoryItem')
      .where('pkg.tenantId = :tenantId', { tenantId })
      .orderBy('pkg.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (outletId) {
      qb.andWhere('(pkg.outletId = :outletId OR pkg.outletId IS NULL)', {
        outletId,
      });
    }

    if (status) {
      qb.andWhere('pkg.status = :status', { status });
    }

    if (search) {
      qb.andWhere('LOWER(pkg.name) LIKE LOWER(:search)', {
        search: `%${search}%`,
      });
    }

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get detail packaging by ID
   */
  async findById(tenantId: string, id: string): Promise<Packaging> {
    const packaging = await this.packagings.findOne({
      where: { id, tenantId },
      relations: { outlet: true, inventoryItem: true },
    });

    if (!packaging) {
      throw new NotFoundException({
        success: false,
        message: 'Packaging not found',
        code: 'PACKAGING_NOT_FOUND',
      });
    }

    return packaging;
  }

  /**
   * Create packaging configuration
   */
  async create(
    tenantId: string,
    actorId: string,
    dto: CreatePackagingDto,
  ): Promise<Packaging> {
    if (dto.outletId) {
      const outlet = await this.outlets.findOne({
        where: { id: dto.outletId, tenantId },
      });
      if (!outlet) {
        throw new BadRequestException({
          success: false,
          message: 'Outlet not found or does not belong to this tenant',
          code: 'OUTLET_NOT_FOUND',
        });
      }
    }

    if (dto.inventoryItemId) {
      const item = await this.inventoryItems.findOne({
        where: { id: dto.inventoryItemId, tenantId },
      });
      if (!item) {
        throw new BadRequestException({
          success: false,
          message: 'Inventory item not found or does not belong to this tenant',
          code: 'INVENTORY_ITEM_NOT_FOUND',
        });
      }
    }

    const packaging = this.packagings.create({
      tenantId,
      name: dto.name,
      outletId: dto.outletId ?? null,
      inventoryItemId: dto.inventoryItemId ?? null,
      extraPrice: dto.extraPrice ?? 0,
      applyToOrderType: dto.applyToOrderType ?? 'TAKE_AWAY',
      status: dto.status ?? 'ACTIVE',
    });

    const saved = await this.packagings.save(packaging);

    await this.audit.record({
      action: 'PACKAGING_CREATED',
      tenantId,
      actorType: 'USER',
      actorId,
      metadata: {
        packagingId: saved.id,
        name: saved.name,
        extraPrice: saved.extraPrice,
        inventoryItemId: saved.inventoryItemId,
      },
    });

    return this.findById(tenantId, saved.id);
  }

  /**
   * Update packaging configuration
   */
  async update(
    tenantId: string,
    id: string,
    actorId: string,
    dto: UpdatePackagingDto,
  ): Promise<Packaging> {
    const packaging = await this.packagings.findOne({
      where: { id, tenantId },
    });

    if (!packaging) {
      throw new NotFoundException({
        success: false,
        message: 'Packaging not found',
        code: 'PACKAGING_NOT_FOUND',
      });
    }

    if (dto.outletId !== undefined) {
      if (dto.outletId) {
        const outlet = await this.outlets.findOne({
          where: { id: dto.outletId, tenantId },
        });
        if (!outlet) {
          throw new BadRequestException({
            success: false,
            message: 'Outlet not found or does not belong to this tenant',
            code: 'OUTLET_NOT_FOUND',
          });
        }
        packaging.outletId = dto.outletId;
      } else {
        packaging.outletId = null;
      }
    }

    if (dto.inventoryItemId !== undefined) {
      if (dto.inventoryItemId) {
        const item = await this.inventoryItems.findOne({
          where: { id: dto.inventoryItemId, tenantId },
        });
        if (!item) {
          throw new BadRequestException({
            success: false,
            message:
              'Inventory item not found or does not belong to this tenant',
            code: 'INVENTORY_ITEM_NOT_FOUND',
          });
        }
        packaging.inventoryItemId = dto.inventoryItemId;
      } else {
        packaging.inventoryItemId = null;
      }
    }

    if (dto.name !== undefined) {
      packaging.name = dto.name;
    }

    if (dto.extraPrice !== undefined) {
      packaging.extraPrice = dto.extraPrice;
    }

    if (dto.applyToOrderType !== undefined) {
      packaging.applyToOrderType = dto.applyToOrderType;
    }

    if (dto.status !== undefined) {
      packaging.status = dto.status;
    }

    await this.packagings.save(packaging);

    await this.audit.record({
      action: 'PACKAGING_UPDATED',
      tenantId,
      actorType: 'USER',
      actorId,
      metadata: {
        packagingId: packaging.id,
        updatedFields: Object.keys(dto),
      },
    });

    return this.findById(tenantId, packaging.id);
  }

  /**
   * Delete packaging (soft delete)
   */
  async delete(
    tenantId: string,
    id: string,
    actorId: string,
  ): Promise<{ success: boolean; message: string }> {
    const packaging = await this.packagings.findOne({
      where: { id, tenantId },
    });

    if (!packaging) {
      throw new NotFoundException({
        success: false,
        message: 'Packaging not found',
        code: 'PACKAGING_NOT_FOUND',
      });
    }

    await this.packagings.softDelete(id);

    await this.audit.record({
      action: 'PACKAGING_DELETED',
      tenantId,
      actorType: 'USER',
      actorId,
      metadata: {
        packagingId: packaging.id,
        name: packaging.name,
      },
    });

    return {
      success: true,
      message: 'Packaging deleted successfully',
    };
  }

  /**
   * Query active packagings applicable for order calculations and stock deduction
   */
  async findApplicableForOrder(
    tenantId: string,
    outletId: string,
    orderType: string,
  ): Promise<Packaging[]> {
    return this.packagings
      .createQueryBuilder('pkg')
      .leftJoinAndSelect('pkg.inventoryItem', 'inventoryItem')
      .where('pkg.tenantId = :tenantId', { tenantId })
      .andWhere('pkg.status = :status', { status: 'ACTIVE' })
      .andWhere('(pkg.outletId = :outletId OR pkg.outletId IS NULL)', {
        outletId,
      })
      .andWhere('pkg.applyToOrderType IN (:...orderTypes)', {
        orderTypes: [orderType, 'ALL'],
      })
      .orderBy('pkg.createdAt', 'ASC')
      .getMany();
  }
}
