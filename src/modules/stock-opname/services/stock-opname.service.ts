import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { StockOpname } from '../entities/stock-opname.entity';
import { StockOpnameItem } from '../entities/stock-opname-item.entity';
import { Outlet } from '../../outlet/outlet.entity';
import { InventoryCategory } from '../../inventory/entities/inventory-category.entity';
import { InventoryItem } from '../../inventory/entities/inventory-item.entity';
import { InventoryStock } from '../../inventory/entities/inventory-stock.entity';
import { AuditService } from '../../audit/audit.service';
import {
  CreateStockOpnameDto,
  QueryStockOpnameDto,
  UpdateStockOpnameCountsDto,
} from '../dto/stock-opname.dto';

export interface PaginatedStockOpnames {
  data: StockOpname[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

@Injectable()
export class StockOpnameService {
  constructor(
    @InjectRepository(StockOpname)
    private readonly stockOpnameRepository: Repository<StockOpname>,
    @InjectRepository(StockOpnameItem)
    private readonly stockOpnameItemRepository: Repository<StockOpnameItem>,
    @InjectRepository(Outlet)
    private readonly outletRepository: Repository<Outlet>,
    @InjectRepository(InventoryCategory)
    private readonly categoryRepository: Repository<InventoryCategory>,
    @InjectRepository(InventoryItem)
    private readonly inventoryItemRepository: Repository<InventoryItem>,
    @InjectRepository(InventoryStock)
    private readonly inventoryStockRepository: Repository<InventoryStock>,
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
  ) {}

  /**
   * Get paginated stock opname sessions with search and filters
   */
  async findAll(
    tenantId: string,
    query: QueryStockOpnameDto,
  ): Promise<PaginatedStockOpnames> {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit =
      query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20;
    const skip = (page - 1) * limit;

    const qb = this.stockOpnameRepository
      .createQueryBuilder('opname')
      .leftJoinAndSelect('opname.outlet', 'outlet')
      .leftJoinAndSelect('opname.category', 'category')
      .leftJoinAndSelect('opname.creator', 'creator')
      .leftJoinAndSelect('opname.finalizer', 'finalizer')
      .where('opname.tenantId = :tenantId', { tenantId });

    if (query.status) {
      qb.andWhere('opname.status = :status', { status: query.status });
    }

    if (query.scope) {
      qb.andWhere('opname.scope = :scope', { scope: query.scope });
    }

    if (query.outletId) {
      qb.andWhere('opname.outletId = :outletId', { outletId: query.outletId });
    }

    if (query.categoryId) {
      qb.andWhere('opname.categoryId = :categoryId', {
        categoryId: query.categoryId,
      });
    }

    if (query.startDate) {
      qb.andWhere('opname.opnameDate >= :startDate', {
        startDate: new Date(query.startDate),
      });
    }

    if (query.endDate) {
      qb.andWhere('opname.opnameDate <= :endDate', {
        endDate: new Date(query.endDate),
      });
    }

    if (query.search) {
      qb.andWhere(
        '(LOWER(opname.opnameNumber) LIKE LOWER(:search) OR LOWER(opname.notes) LIKE LOWER(:search))',
        { search: `%${query.search}%` },
      );
    }

    qb.orderBy('opname.createdAt', 'DESC');
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
   * Get stock opname detail by ID
   */
  async findById(tenantId: string, id: string): Promise<StockOpname> {
    const opname = await this.stockOpnameRepository.findOne({
      where: { id, tenantId },
      relations: {
        outlet: true,
        category: true,
        creator: true,
        finalizer: true,
        items: {
          inventoryItem: {
            category: true,
          },
        },
      },
    });

    if (!opname) {
      throw new NotFoundException({
        success: false,
        message: 'Stock opname session not found',
        code: 'STOCK_OPNAME_NOT_FOUND',
      });
    }

    return opname;
  }

  /**
   * Generate next opname number (SO-YYYY-XXXX)
   */
  private async generateOpnameNumber(tenantId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `SO-${year}-`;

    const lastOpname = await this.stockOpnameRepository
      .createQueryBuilder('o')
      .where('o.tenantId = :tenantId', { tenantId })
      .andWhere('o.opnameNumber LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('o.createdAt', 'DESC')
      .getOne();

    let seq = 1;
    if (lastOpname?.opnameNumber) {
      const parts = lastOpname.opnameNumber.split('-');
      const lastSeq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastSeq)) {
        seq = lastSeq + 1;
      }
    }

    return `${prefix}${String(seq).padStart(3, '0')}`;
  }

  /**
   * Create a new stock opname session (Snapshots system stock for items in scope)
   */
  async create(
    tenantId: string,
    actorId: string,
    dto: CreateStockOpnameDto,
  ): Promise<StockOpname> {
    const outlet = await this.outletRepository.findOne({
      where: { id: dto.outletId, tenantId },
    });
    if (!outlet) {
      throw new BadRequestException({
        success: false,
        message: 'Outlet not found or does not belong to this tenant',
        code: 'OUTLET_NOT_FOUND',
      });
    }

    const scope = dto.scope || 'ALL';
    let category: InventoryCategory | null = null;

    if (scope === 'CATEGORY') {
      if (!dto.categoryId) {
        throw new BadRequestException({
          success: false,
          message: 'Category ID is required when scope is CATEGORY',
          code: 'CATEGORY_REQUIRED',
        });
      }
      category = await this.categoryRepository.findOne({
        where: { id: dto.categoryId, tenantId },
      });
      if (!category) {
        throw new BadRequestException({
          success: false,
          message: 'Category not found or does not belong to this tenant',
          code: 'CATEGORY_NOT_FOUND',
        });
      }
    }

    // Query inventory items in scope
    const itemQuery = this.inventoryItemRepository
      .createQueryBuilder('item')
      .where('item.tenantId = :tenantId', { tenantId })
      .andWhere('item.isActive = :isActive', { isActive: true });

    if (scope === 'CATEGORY' && dto.categoryId) {
      itemQuery.andWhere('item.categoryId = :categoryId', {
        categoryId: dto.categoryId,
      });
    }

    const inventoryItems = await itemQuery.getMany();

    if (inventoryItems.length === 0) {
      throw new BadRequestException({
        success: false,
        message: 'No active inventory items found for the selected scope',
        code: 'NO_ITEMS_IN_SCOPE',
      });
    }

    // Query current stock snapshot from inventory_stocks
    const itemIds = inventoryItems.map((i) => i.id);
    const existingStocks = await this.inventoryStockRepository.find({
      where: {
        tenantId,
        outletId: dto.outletId,
        inventoryItemId: In(itemIds),
      },
    });

    const stockMap = new Map<string, number>();
    for (const stock of existingStocks) {
      stockMap.set(stock.inventoryItemId, Number(stock.quantity));
    }

    const opnameNumber = await this.generateOpnameNumber(tenantId);

    // Create StockOpname and Items
    const opnameItems: StockOpnameItem[] = [];
    for (const item of inventoryItems) {
      const currentQty = stockMap.get(item.id) || 0;
      const opnameItem = this.stockOpnameItemRepository.create({
        tenantId,
        inventoryItemId: item.id,
        systemStock: currentQty,
        actualStock: null,
        difference: 0,
        status: 'UNCOUNTED',
        notes: null,
      });
      opnameItems.push(opnameItem);
    }

    const opname = this.stockOpnameRepository.create({
      tenantId,
      outletId: dto.outletId,
      opnameNumber,
      opnameDate: dto.opnameDate ? new Date(dto.opnameDate) : new Date(),
      status: 'IN_PROGRESS',
      scope,
      categoryId: scope === 'CATEGORY' ? (dto.categoryId ?? null) : null,
      totalItems: opnameItems.length,
      countedItems: 0,
      matchedItems: 0,
      deficitItems: 0,
      surplusItems: 0,
      totalDifferenceValue: 0,
      notes: dto.notes ?? null,
      createdBy: actorId,
      items: opnameItems,
    });

    const saved = await this.stockOpnameRepository.save(opname);

    await this.audit.record({
      action: 'STOCK_OPNAME_CREATED',
      tenantId,
      actorType: 'USER',
      actorId,
      metadata: {
        opnameId: saved.id,
        opnameNumber: saved.opnameNumber,
        outletId: saved.outletId,
        scope: saved.scope,
        totalItems: saved.totalItems,
      },
    });

    return this.findById(tenantId, saved.id);
  }

  /**
   * Update physical counts for items in a stock opname session
   */
  async updateCounts(
    tenantId: string,
    id: string,
    actorId: string,
    dto: UpdateStockOpnameCountsDto,
  ): Promise<StockOpname> {
    const opname = await this.findById(tenantId, id);

    if (opname.status === 'COMPLETED' || opname.status === 'CANCELLED') {
      throw new BadRequestException({
        success: false,
        message: `Cannot update counts for a ${opname.status} stock opname session`,
        code: 'STOCK_OPNAME_IMMUTABLE',
      });
    }

    const itemMap = new Map<string, StockOpnameItem>();
    for (const item of opname.items) {
      itemMap.set(item.inventoryItemId, item);
    }

    for (const countInput of dto.items) {
      const item = itemMap.get(countInput.inventoryItemId);
      if (!item) {
        throw new BadRequestException({
          success: false,
          message: `Inventory item ${countInput.inventoryItemId} is not part of this stock opname session`,
          code: 'ITEM_NOT_IN_SESSION',
        });
      }

      const actualStock = Number(countInput.actualStock);
      const systemStock = Number(item.systemStock);
      const difference = actualStock - systemStock;

      item.actualStock = actualStock;
      item.difference = difference;
      if (countInput.notes !== undefined) {
        item.notes = countInput.notes ?? null;
      }

      if (difference === 0) {
        item.status = 'MATCH';
      } else if (difference < 0) {
        item.status = 'DEFICIT';
      } else {
        item.status = 'SURPLUS';
      }
    }

    // Save updated items
    await this.stockOpnameItemRepository.save(opname.items);

    // Recalculate summary metrics
    let countedItems = 0;
    let matchedItems = 0;
    let deficitItems = 0;
    let surplusItems = 0;
    let totalDifferenceValue = 0;

    for (const item of opname.items) {
      if (item.actualStock !== null && item.actualStock !== undefined) {
        countedItems++;
        if (item.status === 'MATCH') {
          matchedItems++;
        } else if (item.status === 'DEFICIT') {
          deficitItems++;
        } else if (item.status === 'SURPLUS') {
          surplusItems++;
        }

        const unitCost = Number(item.inventoryItem?.unitCost || 0);
        totalDifferenceValue += item.difference * unitCost;
      }
    }

    opname.countedItems = countedItems;
    opname.matchedItems = matchedItems;
    opname.deficitItems = deficitItems;
    opname.surplusItems = surplusItems;
    opname.totalDifferenceValue = Math.round(totalDifferenceValue * 100) / 100;

    await this.stockOpnameRepository.save(opname);

    await this.audit.record({
      action: 'STOCK_OPNAME_COUNTS_UPDATED',
      tenantId,
      actorType: 'USER',
      actorId,
      metadata: {
        opnameId: opname.id,
        countedItems: opname.countedItems,
        matchedItems: opname.matchedItems,
        deficitItems: opname.deficitItems,
        surplusItems: opname.surplusItems,
        totalDifferenceValue: opname.totalDifferenceValue,
      },
    });

    return this.findById(tenantId, opname.id);
  }

  /**
   * Finalize stock opname session (Audit / SOP Inspection completed)
   * NOTE: Stock Opname is purely an operational audit check.
   * IT DOES NOT ADJUST OR MUTATE SYSTEM INVENTORY STOCKS.
   */
  async finalize(
    tenantId: string,
    id: string,
    actorId: string,
    notes?: string,
  ): Promise<StockOpname> {
    const opname = await this.findById(tenantId, id);

    if (opname.status === 'COMPLETED' || opname.status === 'CANCELLED') {
      throw new BadRequestException({
        success: false,
        message: `Cannot finalize a ${opname.status} stock opname session`,
        code: 'STOCK_OPNAME_IMMUTABLE',
      });
    }

    opname.status = 'COMPLETED';
    opname.finalizedAt = new Date();
    opname.finalizedBy = actorId;
    if (notes !== undefined) {
      opname.notes = notes;
    }

    await this.stockOpnameRepository.save(opname);

    await this.audit.record({
      action: 'STOCK_OPNAME_FINALIZED',
      tenantId,
      actorType: 'USER',
      actorId,
      metadata: {
        opnameId: opname.id,
        opnameNumber: opname.opnameNumber,
        totalItems: opname.totalItems,
        countedItems: opname.countedItems,
        matchedItems: opname.matchedItems,
        deficitItems: opname.deficitItems,
        surplusItems: opname.surplusItems,
        totalDifferenceValue: opname.totalDifferenceValue,
      },
    });

    return this.findById(tenantId, opname.id);
  }

  /**
   * Cancel an in-progress stock opname session
   */
  async cancel(
    tenantId: string,
    id: string,
    actorId: string,
    notes?: string,
  ): Promise<StockOpname> {
    const opname = await this.findById(tenantId, id);

    if (opname.status === 'COMPLETED' || opname.status === 'CANCELLED') {
      throw new BadRequestException({
        success: false,
        message: `Cannot cancel a ${opname.status} stock opname session`,
        code: 'STOCK_OPNAME_IMMUTABLE',
      });
    }

    opname.status = 'CANCELLED';
    if (notes !== undefined) {
      opname.notes = notes;
    }

    await this.stockOpnameRepository.save(opname);

    await this.audit.record({
      action: 'STOCK_OPNAME_CANCELLED',
      tenantId,
      actorType: 'USER',
      actorId,
      metadata: {
        opnameId: opname.id,
        opnameNumber: opname.opnameNumber,
      },
    });

    return this.findById(tenantId, opname.id);
  }
}
