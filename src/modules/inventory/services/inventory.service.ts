import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { InventoryItem } from '../entities/inventory-item.entity';
import { InventoryCategory } from '../entities/inventory-category.entity';
import { InventoryStock } from '../entities/inventory-stock.entity';
import { InventoryMovement } from '../entities/inventory-movement.entity';
import { ReasonCategory } from '../entities/reason-category.entity';
import { StockAdjustment } from '../entities/stock-adjustment.entity';
import { Outlet } from '../../outlet/outlet.entity';
import { AuditService } from '../../audit/audit.service';
import { StorageService } from '../../storage/services/storage.service';
import {
  CreateInventoryItemDto,
  QueryInventoryDto,
  SetStockDto,
  UpdateInventoryItemDto,
} from '../dto/inventory-item.dto';
import {
  CreateInventoryCategoryDto,
  QueryInventoryCategoryDto,
  UpdateInventoryCategoryDto,
} from '../dto/inventory-category.dto';
import {
  CreateReasonCategoryDto,
  CreateStockAdjustmentDto,
  QueryMovementDto,
  QueryStockAdjustmentDto,
  UpdateReasonCategoryDto,
} from '../dto/stock-adjustment.dto';

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(InventoryItem)
    private readonly itemRepository: Repository<InventoryItem>,
    @InjectRepository(InventoryCategory)
    private readonly categoryRepository: Repository<InventoryCategory>,
    @InjectRepository(InventoryStock)
    private readonly stockRepository: Repository<InventoryStock>,
    @InjectRepository(InventoryMovement)
    private readonly movementRepository: Repository<InventoryMovement>,
    @InjectRepository(ReasonCategory)
    private readonly reasonRepository: Repository<ReasonCategory>,
    @InjectRepository(StockAdjustment)
    private readonly adjustmentRepository: Repository<StockAdjustment>,
    @InjectRepository(Outlet)
    private readonly outletRepository: Repository<Outlet>,
    private readonly storageService: StorageService,
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
  ) {}

  // ==========================================
  // INVENTORY CATEGORY CRUD
  // ==========================================

  async findAllCategories(tenantId: string, query: QueryInventoryCategoryDto) {
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
        message: 'Inventory category not found',
        code: 'INVENTORY_CATEGORY_NOT_FOUND',
      });
    }

    return category;
  }

  async createCategory(tenantId: string, dto: CreateInventoryCategoryDto) {
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
    dto: UpdateInventoryCategoryDto,
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
      message: 'Inventory category deleted successfully',
    };
  }

  // ==========================================
  // INVENTORY ITEMS
  // ==========================================

  async findAll(tenantId: string, query: QueryInventoryDto) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit =
      query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20;
    const skip = (page - 1) * limit;

    const qb = this.itemRepository
      .createQueryBuilder('item')
      .leftJoinAndSelect('item.category', 'category')
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

    if (query.categoryId) {
      qb.andWhere('item.categoryId = :categoryId', {
        categoryId: query.categoryId,
      });
    }

    if (query.itemType && query.itemType.toUpperCase() !== 'ALL') {
      qb.andWhere('item.itemType = :itemType', {
        itemType: query.itemType.toUpperCase(),
      });
    }

    if (query.status) {
      qb.andWhere('item.status = :status', { status: query.status });
    }

    if (query.search) {
      qb.andWhere(
        '(LOWER(item.name) LIKE LOWER(:search) OR LOWER(item.sku) LIKE LOWER(:search) OR LOWER(item.description) LIKE LOWER(:search))',
        { search: `%${query.search}%` },
      );
    }

    if (query.stockStatus && query.stockStatus.toUpperCase() !== 'ALL') {
      const statusFilter = query.stockStatus.toUpperCase();
      if (statusFilter === 'OUT_OF_STOCK') {
        qb.andWhere('(stock.quantity IS NULL OR stock.quantity <= 0)');
      } else if (statusFilter === 'LOW_STOCK') {
        qb.andWhere(
          'stock.quantity > 0 AND stock.quantity <= item.minimumStock',
        );
      } else if (statusFilter === 'NORMAL') {
        qb.andWhere('stock.quantity > item.minimumStock');
      }
    }

    const sortColumn =
      query.sortBy === 'name'
        ? 'item.name'
        : query.sortBy === 'sku'
          ? 'item.sku'
          : query.sortBy === 'unitCost'
            ? 'item.unitCost'
            : 'item.createdAt';
    const sortOrder = query.sortOrder?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    qb.orderBy(sortColumn, sortOrder);
    qb.skip(skip).take(limit);

    const [items, total] = await qb.getManyAndCount();

    const data = items.map((item) => {
      const currentStock =
        item.stocks && item.stocks.length > 0
          ? Number(item.stocks[0].quantity || 0)
          : 0;
      const unitCost = Number(item.unitCost || 0);
      const minimumStock = Number(item.minimumStock || 0);
      const stockValue = Math.round(currentStock * unitCost * 100) / 100;

      let stockStatus = 'NORMAL';
      if (currentStock <= 0) {
        stockStatus = 'OUT_OF_STOCK';
      } else if (currentStock <= minimumStock) {
        stockStatus = 'LOW_STOCK';
      }

      return {
        ...item,
        currentStock,
        stockValue,
        stockStatus,
      };
    });

    // Summary Metrics Cards
    const summaryQb = this.itemRepository
      .createQueryBuilder('item')
      .where('item.tenantId = :tenantId', { tenantId });

    if (query.outletId) {
      summaryQb.leftJoin('item.stocks', 'stock', 'stock.outletId = :outletId', {
        outletId: query.outletId,
      });
    } else {
      summaryQb.leftJoin('item.stocks', 'stock');
    }

    if (query.itemType && query.itemType.toUpperCase() !== 'ALL') {
      summaryQb.andWhere('item.itemType = :itemType', {
        itemType: query.itemType.toUpperCase(),
      });
    }

    const summaryResult = await summaryQb
      .select('COUNT(DISTINCT item.id)', 'totalItems')
      .addSelect(
        'SUM(COALESCE(stock.quantity, 0) * COALESCE(item.unitCost, 0))',
        'totalInventoryValue',
      )
      .addSelect(
        'COUNT(DISTINCT CASE WHEN COALESCE(stock.quantity, 0) > 0 AND COALESCE(stock.quantity, 0) <= item.minimumStock THEN item.id END)',
        'lowStockCount',
      )
      .addSelect(
        'COUNT(DISTINCT CASE WHEN COALESCE(stock.quantity, 0) <= 0 THEN item.id END)',
        'outOfStockCount',
      )
      .getRawOne<{
        totalItems?: string | number;
        totalInventoryValue?: string | number;
        lowStockCount?: string | number;
        outOfStockCount?: string | number;
      }>();

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      summary: {
        totalItems: Number(summaryResult?.totalItems || 0),
        totalInventoryValue:
          Math.round(Number(summaryResult?.totalInventoryValue || 0) * 100) /
          100,
        lowStockCount: Number(summaryResult?.lowStockCount || 0),
        outOfStockCount: Number(summaryResult?.outOfStockCount || 0),
      },
    };
  }

  async findById(tenantId: string, id: string, outletId?: string) {
    const qb = this.itemRepository
      .createQueryBuilder('item')
      .leftJoinAndSelect('item.category', 'category')
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

    const currentStock =
      item.stocks && item.stocks.length > 0
        ? Number(item.stocks[0].quantity || 0)
        : 0;
    const unitCost = Number(item.unitCost || 0);
    const minimumStock = Number(item.minimumStock || 0);
    const stockValue = Math.round(currentStock * unitCost * 100) / 100;

    let stockStatus = 'NORMAL';
    if (currentStock <= 0) {
      stockStatus = 'OUT_OF_STOCK';
    } else if (currentStock <= minimumStock) {
      stockStatus = 'LOW_STOCK';
    }

    return {
      ...item,
      currentStock,
      stockValue,
      stockStatus,
    };
  }

  async create(tenantId: string, dto: CreateInventoryItemDto) {
    if (dto.categoryId) {
      await this.findCategoryById(tenantId, dto.categoryId);
    }

    const item = this.itemRepository.create({
      tenantId,
      name: dto.name,
      itemType: dto.itemType ?? 'RAW_MATERIAL',
      sku: dto.sku ?? null,
      categoryId: dto.categoryId ?? null,
      description: dto.description ?? null,
      unit: dto.unit ?? 'pcs',
      unitCost: dto.unitCost ?? 0,
      minimumStock: dto.minimumStock ?? 0,
      status: dto.status ?? 'ACTIVE',
    });

    const saved = await this.itemRepository.save(item);
    return this.findById(tenantId, saved.id);
  }

  async update(tenantId: string, id: string, dto: UpdateInventoryItemDto) {
    const item = await this.itemRepository.findOne({ where: { id, tenantId } });
    if (!item) {
      throw new NotFoundException({
        success: false,
        message: 'Inventory item not found',
        code: 'INVENTORY_ITEM_NOT_FOUND',
      });
    }

    if (dto.categoryId !== undefined) {
      if (dto.categoryId) {
        await this.findCategoryById(tenantId, dto.categoryId);
      }
      item.categoryId = dto.categoryId ?? null;
    }

    if (dto.itemType !== undefined) {
      item.itemType = dto.itemType;
    }

    item.name = dto.name;
    item.sku = dto.sku ?? null;
    if (dto.description !== undefined) {
      item.description = dto.description ?? null;
    }
    item.unit = dto.unit;
    if (dto.unitCost !== undefined) {
      item.unitCost = dto.unitCost;
    }
    item.minimumStock = dto.minimumStock;
    item.status = dto.status;

    await this.itemRepository.save(item);
    return this.findById(tenantId, id);
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

  private async generateAdjustmentNumber(tenantId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `ADJ-${year}-`;

    const lastAdj = await this.adjustmentRepository
      .createQueryBuilder('a')
      .where('a.tenantId = :tenantId', { tenantId })
      .andWhere('a.adjustmentNumber LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('a.createdAt', 'DESC')
      .getOne();

    let seq = 1;
    if (lastAdj?.adjustmentNumber) {
      const parts = lastAdj.adjustmentNumber.split('-');
      const lastSeq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastSeq)) {
        seq = lastSeq + 1;
      }
    }

    return `${prefix}${String(seq).padStart(3, '0')}`;
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

    const inventoryItemId = dto.inventoryItemId || dto.itemId;
    if (!inventoryItemId) {
      throw new BadRequestException({
        success: false,
        message: 'Inventory item ID is required',
        code: 'ITEM_REQUIRED',
      });
    }

    const item = await this.itemRepository.findOne({
      where: { id: inventoryItemId, tenantId },
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

    const adjustmentNumber = await this.generateAdjustmentNumber(tenantId);

    return this.dataSource.transaction(async (manager) => {
      const stockRepo = manager.getRepository(InventoryStock);
      const movementRepo = manager.getRepository(InventoryMovement);
      const adjustmentRepo = manager.getRepository(StockAdjustment);

      let stock = await stockRepo.findOne({
        where: {
          tenantId,
          outletId: targetOutletId,
          inventoryItemId,
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
          inventoryItemId,
          quantity: newQty,
        });
      } else {
        stock.quantity = newQty;
      }
      await stockRepo.save(stock);

      const adjustment = adjustmentRepo.create({
        tenantId,
        outletId: targetOutletId,
        adjustmentNumber,
        adjustmentDate: dto.adjustmentDate
          ? new Date(dto.adjustmentDate)
          : new Date(),
        type: dto.type,
        inventoryItemId,
        previousStock: currentQty,
        quantity: dto.quantity,
        currentStock: newQty,
        reasonCategoryId: dto.reasonCategoryId ?? null,
        notes: dto.notes ?? null,
        imageUrl: dto.imageUrl ?? null,
        source: dto.source ?? 'MANUAL',
        status: 'COMPLETED',
        createdBy: userId,
      });
      const savedAdjustment = await adjustmentRepo.save(adjustment);

      const movement = movementRepo.create({
        tenantId,
        outletId: targetOutletId,
        inventoryItemId,
        movementType: dto.type,
        quantity: dto.quantity,
        referenceType: 'STOCK_ADJUSTMENT',
        referenceId: adjustmentNumber,
        reasonCategoryId: dto.reasonCategoryId ?? null,
        notes: dto.notes ?? null,
        movementDate: dto.adjustmentDate
          ? new Date(dto.adjustmentDate)
          : new Date(),
        createdBy: userId,
      });
      await movementRepo.save(movement);

      await this.audit.record(
        {
          action: 'INVENTORY_ADJUSTMENT',
          tenantId,
          actorType: 'USER',
          actorId: userId,
          metadata: {
            adjustmentId: savedAdjustment.id,
            adjustmentNumber: savedAdjustment.adjustmentNumber,
            itemId: inventoryItemId,
            type: dto.type,
            quantity: dto.quantity,
            previousStock: currentQty,
            currentStock: newQty,
          },
        },
        manager,
      );

      return this.findAdjustmentById(tenantId, savedAdjustment.id);
    });
  }

  async findAllAdjustments(tenantId: string, query: QueryStockAdjustmentDto) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit =
      query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20;
    const skip = (page - 1) * limit;

    const qb = this.adjustmentRepository
      .createQueryBuilder('adj')
      .leftJoinAndSelect('adj.outlet', 'outlet')
      .leftJoinAndSelect('adj.inventoryItem', 'inventoryItem')
      .leftJoinAndSelect('inventoryItem.category', 'itemCategory')
      .leftJoinAndSelect('adj.reasonCategory', 'reasonCategory')
      .leftJoinAndSelect('adj.creator', 'creator')
      .where('adj.tenantId = :tenantId', { tenantId });

    if (query.outletId) {
      qb.andWhere('adj.outletId = :outletId', { outletId: query.outletId });
    }

    if (query.inventoryItemId) {
      qb.andWhere('adj.inventoryItemId = :inventoryItemId', {
        inventoryItemId: query.inventoryItemId,
      });
    }

    if (query.reasonCategoryId) {
      qb.andWhere('adj.reasonCategoryId = :reasonCategoryId', {
        reasonCategoryId: query.reasonCategoryId,
      });
    }

    if (query.type) {
      qb.andWhere('adj.type = :type', { type: query.type });
    }

    if (query.startDate) {
      qb.andWhere('adj.adjustmentDate >= :startDate', {
        startDate: new Date(query.startDate),
      });
    }

    if (query.endDate) {
      qb.andWhere('adj.adjustmentDate <= :endDate', {
        endDate: new Date(query.endDate),
      });
    }

    if (query.search) {
      qb.andWhere(
        '(LOWER(adj.adjustmentNumber) LIKE LOWER(:search) OR LOWER(inventoryItem.name) LIKE LOWER(:search) OR LOWER(reasonCategory.name) LIKE LOWER(:search) OR LOWER(adj.notes) LIKE LOWER(:search))',
        { search: `%${query.search}%` },
      );
    }

    qb.orderBy('adj.adjustmentDate', 'DESC');
    qb.skip(skip).take(limit);

    const [items, total] = await qb.getManyAndCount();

    // Summary Metrics Cards
    const summaryQb = this.adjustmentRepository
      .createQueryBuilder('adj')
      .innerJoin('adj.inventoryItem', 'inventoryItem')
      .where('adj.tenantId = :tenantId', { tenantId });

    if (query.outletId) {
      summaryQb.andWhere('adj.outletId = :outletId', {
        outletId: query.outletId,
      });
    }

    if (query.startDate) {
      summaryQb.andWhere('adj.adjustmentDate >= :startDate', {
        startDate: new Date(query.startDate),
      });
    }

    if (query.endDate) {
      summaryQb.andWhere('adj.adjustmentDate <= :endDate', {
        endDate: new Date(query.endDate),
      });
    }

    const summaryResult = await summaryQb
      .select('COUNT(adj.id)', 'totalAdjustments')
      .addSelect("COUNT(CASE WHEN adj.type = 'IN' THEN 1 END)", 'totalIn')
      .addSelect("COUNT(CASE WHEN adj.type = 'OUT' THEN 1 END)", 'totalOut')
      .addSelect(
        "SUM(CASE WHEN adj.type = 'OUT' THEN adj.quantity * COALESCE(inventoryItem.unitCost, 0) ELSE 0 END)",
        'totalLossValue',
      )
      .getRawOne<{
        totalAdjustments?: string | number;
        totalIn?: string | number;
        totalOut?: string | number;
        totalLossValue?: string | number;
      }>();

    return {
      data: items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      summary: {
        totalAdjustments: Number(summaryResult?.totalAdjustments || 0),
        totalIn: Number(summaryResult?.totalIn || 0),
        totalOut: Number(summaryResult?.totalOut || 0),
        totalLossValue:
          Math.round(Number(summaryResult?.totalLossValue || 0) * 100) / 100,
      },
    };
  }

  async findAdjustmentById(
    tenantId: string,
    id: string,
  ): Promise<StockAdjustment> {
    const adjustment = await this.adjustmentRepository.findOne({
      where: { id, tenantId },
      relations: {
        outlet: true,
        inventoryItem: {
          category: true,
        },
        reasonCategory: true,
        creator: true,
      },
    });

    if (!adjustment) {
      throw new NotFoundException({
        success: false,
        message: 'Stock adjustment not found',
        code: 'STOCK_ADJUSTMENT_NOT_FOUND',
      });
    }

    return adjustment;
  }

  async uploadAdjustmentProof(
    tenantId: string,
    file: Express.Multer.File,
  ): Promise<{ imageUrl: string }> {
    const imageUrl = await this.storageService.uploadAdjustmentProof(
      tenantId,
      file,
    );
    return { imageUrl };
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

    const data = items.map((mov) => {
      const typeUpper = (mov.movementType || '').toUpperCase();
      const isOut = [
        'OUT',
        'SALE',
        'ADJUSTMENT_OUT',
        'VOID',
        'WASTE',
        'TRANSFER_OUT',
      ].includes(typeUpper);
      const isIn = [
        'IN',
        'PURCHASE',
        'ADJUSTMENT_IN',
        'INITIAL',
        'TRANSFER_IN',
      ].includes(typeUpper);

      return {
        ...mov,
        inQuantity: isIn ? Number(mov.quantity || 0) : 0,
        outQuantity: isOut ? Number(mov.quantity || 0) : 0,
      };
    });

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
