import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Packaging } from '../entities/packaging.entity';
import { PackagingCategory } from '../entities/packaging-category.entity';
import { Outlet } from '../../outlet/outlet.entity';
import { InventoryItem } from '../../inventory/entities/inventory-item.entity';
import { AuditService } from '../../audit/audit.service';
import {
  CreatePackagingDto,
  QueryPackagingDto,
  UpdatePackagingDto,
} from '../dto/packaging.dto';
import {
  CreatePackagingCategoryDto,
  QueryPackagingCategoryDto,
  UpdatePackagingCategoryDto,
} from '../dto/packaging-category.dto';

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
    @InjectRepository(PackagingCategory)
    private readonly categoryRepository: Repository<PackagingCategory>,
    @InjectRepository(Outlet)
    private readonly outlets: Repository<Outlet>,
    @InjectRepository(InventoryItem)
    private readonly inventoryItems: Repository<InventoryItem>,
    private readonly audit: AuditService,
  ) {}

  // ==========================================
  // PACKAGING CATEGORY CRUD
  // ==========================================

  async findAllCategories(tenantId: string, query: QueryPackagingCategoryDto) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit =
      query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20;
    const skip = (page - 1) * limit;

    const qb = this.categoryRepository
      .createQueryBuilder('cat')
      .where('cat.tenantId = :tenantId', { tenantId });

    if (query.status) {
      qb.andWhere('cat.status = :status', { status: query.status });
    }

    if (query.search) {
      qb.andWhere(
        '(LOWER(cat.name) LIKE LOWER(:search) OR LOWER(cat.description) LIKE LOWER(:search))',
        { search: `%${query.search}%` },
      );
    }

    qb.orderBy('cat.createdAt', 'DESC');
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

  async findCategoryById(tenantId: string, id: string) {
    const category = await this.categoryRepository.findOne({
      where: { id, tenantId },
    });

    if (!category) {
      throw new NotFoundException({
        success: false,
        message: 'Packaging category not found',
        code: 'PACKAGING_CATEGORY_NOT_FOUND',
      });
    }

    return category;
  }

  async createCategory(tenantId: string, dto: CreatePackagingCategoryDto) {
    const category = this.categoryRepository.create({
      tenantId,
      name: dto.name,
      description: dto.description ?? null,
      status: dto.status ?? 'ACTIVE',
    });

    return this.categoryRepository.save(category);
  }

  async updateCategory(
    tenantId: string,
    id: string,
    dto: UpdatePackagingCategoryDto,
  ) {
    const category = await this.findCategoryById(tenantId, id);

    category.name = dto.name;
    if (dto.description !== undefined) {
      category.description = dto.description ?? null;
    }
    if (dto.status !== undefined) {
      category.status = dto.status;
    }

    return this.categoryRepository.save(category);
  }

  async deleteCategory(tenantId: string, id: string) {
    const category = await this.findCategoryById(tenantId, id);
    await this.categoryRepository.softRemove(category);
    return {
      success: true,
      message: 'Packaging category deleted successfully',
    };
  }

  // ==========================================
  // PACKAGINGS
  // ==========================================

  /**
   * Get list packaging scoped to tenant with pagination and optional filters
   */
  async findAll(
    tenantId: string,
    query: QueryPackagingDto,
  ): Promise<PaginatedPackagings> {
    const {
      page = 1,
      limit = 20,
      outletId,
      categoryId,
      status,
      search,
    } = query;

    const qb = this.packagings
      .createQueryBuilder('pkg')
      .leftJoinAndSelect('pkg.outlet', 'outlet')
      .leftJoinAndSelect('pkg.category', 'category')
      .leftJoinAndSelect('pkg.inventoryItem', 'inventoryItem')
      .leftJoinAndSelect('inventoryItem.stocks', 'stock')
      .where('pkg.tenantId = :tenantId', { tenantId })
      .orderBy('pkg.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (outletId) {
      qb.andWhere('(pkg.outletId = :outletId OR pkg.outletId IS NULL)', {
        outletId,
      });
    }

    if (categoryId) {
      qb.andWhere('pkg.categoryId = :categoryId', { categoryId });
    }

    if (status) {
      qb.andWhere('pkg.status = :status', { status });
    }

    if (search) {
      qb.andWhere(
        '(LOWER(pkg.name) LIKE LOWER(:search) OR LOWER(pkg.sku) LIKE LOWER(:search) OR LOWER(category.name) LIKE LOWER(:search))',
        {
          search: `%${search}%`,
        },
      );
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
      relations: {
        outlet: true,
        category: true,
        inventoryItem: {
          stocks: true,
        },
      },
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

    if (dto.categoryId) {
      await this.findCategoryById(tenantId, dto.categoryId);
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
      sku: dto.sku ?? null,
      categoryId: dto.categoryId ?? null,
      description: dto.description ?? null,
      outletId: dto.outletId ?? null,
      inventoryItemId: dto.inventoryItemId ?? null,
      costPrice: 0,
      extraPrice: 0,
      applyToOrderType: 'TAKE_AWAY',
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
        sku: saved.sku,
        categoryId: saved.categoryId,
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

    if (dto.categoryId !== undefined) {
      if (dto.categoryId) {
        await this.findCategoryById(tenantId, dto.categoryId);
      }
      packaging.categoryId = dto.categoryId ?? null;
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

    if (dto.sku !== undefined) {
      packaging.sku = dto.sku ?? null;
    }

    if (dto.description !== undefined) {
      packaging.description = dto.description ?? null;
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
