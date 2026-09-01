import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { InventoryItem } from '../entities/inventory-item.entity';
import { InventoryStock } from '../entities/inventory-stock.entity';
import { InventoryMovement } from '../entities/inventory-movement.entity';
import { ReasonCategory } from '../entities/reason-category.entity';
import { Outlet } from '../../outlet/outlet.entity';
import { AuditService } from '../../audit/audit.service';
import {
  CreateInventoryItemDto,
  QueryInventoryDto,
  SetStockDto,
  UpdateInventoryItemDto,
} from '../dto/inventory-item.dto';
import {
  CreateReasonCategoryDto,
  CreateStockAdjustmentDto,
  QueryMovementDto,
  UpdateReasonCategoryDto,
} from '../dto/stock-adjustment.dto';

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(InventoryItem)
    private readonly itemRepository: Repository<InventoryItem>,
    @InjectRepository(InventoryStock)
    private readonly stockRepository: Repository<InventoryStock>,
    @InjectRepository(InventoryMovement)
    private readonly movementRepository: Repository<InventoryMovement>,
    @InjectRepository(ReasonCategory)
    private readonly reasonRepository: Repository<ReasonCategory>,
    @InjectRepository(Outlet)
    private readonly outletRepository: Repository<Outlet>,
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
  ) {}

  async findAll(tenantId: string, query: QueryInventoryDto) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit =
      query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20;
    const skip = (page - 1) * limit;

    const qb = this.itemRepository
      .createQueryBuilder('item')
      .where('item.tenantId = :tenantId', { tenantId });

    if (query.outletId) {
      qb.leftJoinAndSelect(
        'item.stocks',
        'stock',
        'stock.outletId = :outletId',
        { outletId: query.outletId },
      );
    } else {
      qb.leftJoinAndSelect('item.stocks', 'stock');
    }

    if (query.status) {
      qb.andWhere('item.status = :status', { status: query.status });
    }

    if (query.search) {
      qb.andWhere(
        '(LOWER(item.name) LIKE LOWER(:search) OR LOWER(item.sku) LIKE LOWER(:search))',
        { search: `%${query.search}%` },
      );
    }

    const sortColumn = query.sortBy === 'name' ? 'item.name' : 'item.createdAt';
    const sortOrder = query.sortOrder?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    qb.orderBy(sortColumn, sortOrder);
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

  async findById(tenantId: string, id: string, outletId?: string) {
    const qb = this.itemRepository
      .createQueryBuilder('item')
      .where('item.id = :id AND item.tenantId = :tenantId', { id, tenantId });

    if (outletId) {
      qb.leftJoinAndSelect(
        'item.stocks',
        'stock',
        'stock.outletId = :outletId',
        { outletId },
      );
    } else {
      qb.leftJoinAndSelect('item.stocks', 'stock');
    }

    const item = await qb.getOne();

    if (!item) {
      throw new NotFoundException({
        success: false,
        message: 'Inventory item not found',
        code: 'INVENTORY_ITEM_NOT_FOUND',
      });
    }

    return item;
  }

  async create(tenantId: string, dto: CreateInventoryItemDto) {
    const item = this.itemRepository.create({
      tenantId,
      name: dto.name,
      sku: dto.sku ?? null,
      unit: dto.unit ?? 'pcs',
      minimumStock: dto.minimumStock ?? 0,
      status: dto.status ?? 'ACTIVE',
    });

    return this.itemRepository.save(item);
  }

  async update(tenantId: string, id: string, dto: UpdateInventoryItemDto) {
    const item = await this.findById(tenantId, id);

    item.name = dto.name;
    item.sku = dto.sku ?? null;
    item.unit = dto.unit;
    item.minimumStock = dto.minimumStock;
    item.status = dto.status;

    return this.itemRepository.save(item);
  }

  async delete(tenantId: string, id: string) {
    const item = await this.findById(tenantId, id);
    await this.itemRepository.softRemove(item);
    return {
      success: true,
      message: 'Inventory item deleted successfully',
    };
  }

  async setStock(tenantId: string, itemId: string, dto: SetStockDto) {
    await this.findById(tenantId, itemId);

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

    let stock = await this.stockRepository.findOne({
      where: {
        tenantId,
        outletId: dto.outletId,
        inventoryItemId: itemId,
      },
    });

    if (!stock) {
      stock = this.stockRepository.create({
        tenantId,
        outletId: dto.outletId,
        inventoryItemId: itemId,
        quantity: dto.quantity,
      });
    } else {
      stock.quantity = dto.quantity;
    }

    return this.stockRepository.save(stock);
  }

  async createAdjustment(
    tenantId: string,
    userId: string,
    outletId: string,
    dto: CreateStockAdjustmentDto,
  ) {
    const targetOutletId = dto.outletId ?? outletId;
    if (!targetOutletId) {
      throw new BadRequestException({
        success: false,
        message: 'Outlet ID is required for stock adjustment',
        code: 'OUTLET_REQUIRED',
      });
    }

    const outlet = await this.outletRepository.findOne({
      where: { id: targetOutletId, tenantId },
    });
    if (!outlet) {
      throw new BadRequestException({
        success: false,
        message: 'Outlet not found or does not belong to this tenant',
        code: 'INVALID_OUTLET',
      });
    }

    const item = await this.itemRepository.findOne({
      where: { id: dto.itemId, tenantId },
    });
    if (!item) {
      throw new NotFoundException({
        success: false,
        message: 'Inventory item not found',
        code: 'INVENTORY_ITEM_NOT_FOUND',
      });
    }

    if (dto.reasonCategoryId) {
      const reason = await this.reasonRepository.findOne({
        where: { id: dto.reasonCategoryId, tenantId },
      });
      if (!reason) {
        throw new BadRequestException({
          success: false,
          message: 'Reason category not found or belongs to another tenant',
          code: 'INVALID_REASON_CATEGORY',
        });
      }
      if (reason.type !== 'BOTH' && reason.type !== dto.type) {
        throw new BadRequestException({
          success: false,
          message: `Reason category type (${reason.type}) is not applicable for ${dto.type} adjustment`,
          code: 'REASON_TYPE_MISMATCH',
        });
      }
    }

    return this.dataSource.transaction(async (manager) => {
      const stockRepo = manager.getRepository(InventoryStock);
      const movementRepo = manager.getRepository(InventoryMovement);

      let stock = await stockRepo.findOne({
        where: {
          tenantId,
          outletId: targetOutletId,
          inventoryItemId: dto.itemId,
        },
      });

      const currentQty = stock ? Number(stock.quantity) : 0;
      let newQty: number;

      if (dto.type === 'OUT') {
        if (currentQty < dto.quantity) {
          throw new BadRequestException({
            success: false,
            message: `Insufficient stock balance. Available: ${currentQty}, Requested reduction: ${dto.quantity}`,
            code: 'INSUFFICIENT_STOCK',
          });
        }
        newQty = currentQty - dto.quantity;
      } else {
        newQty = currentQty + dto.quantity;
      }

      if (!stock) {
        stock = stockRepo.create({
          tenantId,
          outletId: targetOutletId,
          inventoryItemId: dto.itemId,
          quantity: newQty,
        });
      } else {
        stock.quantity = newQty;
      }
      await stockRepo.save(stock);

      const movement = movementRepo.create({
        tenantId,
        outletId: targetOutletId,
        inventoryItemId: dto.itemId,
        movementType: dto.type,
        quantity: dto.quantity,
        referenceType: 'ADJUSTMENT',
        reasonCategoryId: dto.reasonCategoryId ?? null,
        notes: dto.notes ?? null,
        movementDate: dto.adjustmentDate
          ? new Date(dto.adjustmentDate)
          : new Date(),
        createdBy: userId,
      });
      const savedMovement = await movementRepo.save(movement);

      await this.audit.record(
        {
          action: 'INVENTORY_ADJUSTMENT',
          tenantId,
          actorType: 'USER',
          actorId: userId,
          metadata: {
            movementId: savedMovement.id,
            itemId: dto.itemId,
            type: dto.type,
            quantity: dto.quantity,
            previousStock: currentQty,
            currentStock: newQty,
          },
        },
        manager,
      );

      return {
        movement: savedMovement,
        previousStock: currentQty,
        currentStock: newQty,
      };
    });
  }

  async findMovements(tenantId: string, query: QueryMovementDto) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit =
      query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20;
    const skip = (page - 1) * limit;

    const qb = this.movementRepository
      .createQueryBuilder('movement')
      .leftJoinAndSelect('movement.inventoryItem', 'item')
      .leftJoinAndSelect('movement.reasonCategory', 'reason')
      .leftJoinAndSelect('movement.outlet', 'outlet')
      .leftJoinAndSelect('movement.creator', 'creator')
      .where('movement.tenantId = :tenantId', { tenantId });

    if (query.outletId) {
      qb.andWhere('movement.outletId = :outletId', {
        outletId: query.outletId,
      });
    }

    if (query.itemId) {
      qb.andWhere('movement.inventoryItemId = :itemId', {
        itemId: query.itemId,
      });
    }

    if (query.movementType) {
      qb.andWhere('movement.movementType = :movementType', {
        movementType: query.movementType,
      });
    }

    if (query.startDate) {
      qb.andWhere('movement.movementDate >= :startDate', {
        startDate: new Date(query.startDate),
      });
    }

    if (query.endDate) {
      qb.andWhere('movement.movementDate <= :endDate', {
        endDate: new Date(query.endDate),
      });
    }

    qb.orderBy('movement.movementDate', 'DESC');
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

  async findAllReasonCategories(tenantId: string, type?: string) {
    const whereClause: { tenantId: string; type?: string } = { tenantId };
    if (type) {
      whereClause.type = type;
    }
    return this.reasonRepository.find({
      where: whereClause,
      order: { name: 'ASC' },
    });
  }

  async createReasonCategory(tenantId: string, dto: CreateReasonCategoryDto) {
    const existing = await this.reasonRepository.findOne({
      where: { tenantId, name: dto.name },
    });
    if (existing) {
      throw new ConflictException({
        success: false,
        message: 'Reason category name already exists',
        code: 'REASON_CATEGORY_NAME_EXISTS',
      });
    }

    const reason = this.reasonRepository.create({
      tenantId,
      name: dto.name,
      type: dto.type ?? 'BOTH',
      status: dto.status ?? 'ACTIVE',
    });

    return this.reasonRepository.save(reason);
  }

  async updateReasonCategory(
    tenantId: string,
    id: string,
    dto: UpdateReasonCategoryDto,
  ) {
    const reason = await this.reasonRepository.findOne({
      where: { id, tenantId },
    });
    if (!reason) {
      throw new NotFoundException({
        success: false,
        message: 'Reason category not found',
        code: 'REASON_CATEGORY_NOT_FOUND',
      });
    }

    if (reason.name !== dto.name) {
      const duplicate = await this.reasonRepository.findOne({
        where: { tenantId, name: dto.name },
      });
      if (duplicate && duplicate.id !== id) {
        throw new ConflictException({
          success: false,
          message: 'Reason category name already exists',
          code: 'REASON_CATEGORY_NAME_EXISTS',
        });
      }
    }

    reason.name = dto.name;
    reason.type = dto.type;
    reason.status = dto.status;

    return this.reasonRepository.save(reason);
  }

  async deleteReasonCategory(tenantId: string, id: string) {
    const reason = await this.reasonRepository.findOne({
      where: { id, tenantId },
    });
    if (!reason) {
      throw new NotFoundException({
        success: false,
        message: 'Reason category not found',
        code: 'REASON_CATEGORY_NOT_FOUND',
      });
    }

    await this.reasonRepository.softRemove(reason);
    return {
      success: true,
      message: 'Reason category deleted successfully',
    };
  }
}
