import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Purchase } from '../entities/purchase.entity';
import { PurchaseItem } from '../entities/purchase-item.entity';
import { Outlet } from '../../outlet/outlet.entity';
import { Supplier } from '../../supplier/entities/supplier.entity';
import { InventoryItem } from '../../inventory/entities/inventory-item.entity';
import { InventoryStock } from '../../inventory/entities/inventory-stock.entity';
import { InventoryMovement } from '../../inventory/entities/inventory-movement.entity';
import { Packaging } from '../../packaging/entities/packaging.entity';
import { AuditService } from '../../audit/audit.service';
import {
  CreatePurchaseDto,
  QueryPurchaseDto,
  ReceivePurchaseDto,
  UpdatePurchaseDto,
} from '../dto/purchase.dto';

export interface PaginatedPurchases {
  data: Purchase[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

@Injectable()
export class PurchaseService {
  constructor(
    @InjectRepository(Purchase)
    private readonly purchaseRepository: Repository<Purchase>,
    @InjectRepository(PurchaseItem)
    private readonly purchaseItemRepository: Repository<PurchaseItem>,
    @InjectRepository(Outlet)
    private readonly outletRepository: Repository<Outlet>,
    @InjectRepository(Supplier)
    private readonly supplierRepository: Repository<Supplier>,
    @InjectRepository(InventoryItem)
    private readonly inventoryItemRepository: Repository<InventoryItem>,
    @InjectRepository(InventoryStock)
    private readonly inventoryStockRepository: Repository<InventoryStock>,
    @InjectRepository(InventoryMovement)
    private readonly inventoryMovementRepository: Repository<InventoryMovement>,
    @InjectRepository(Packaging)
    private readonly packagingRepository: Repository<Packaging>,
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
  ) {}

  /**
   * Get paginated purchases with search and filters
   */
  async findAll(
    tenantId: string,
    query: QueryPurchaseDto,
  ): Promise<PaginatedPurchases> {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit =
      query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20;
    const skip = (page - 1) * limit;

    const qb = this.purchaseRepository
      .createQueryBuilder('purchase')
      .leftJoinAndSelect('purchase.outlet', 'outlet')
      .leftJoinAndSelect('purchase.supplier', 'supplier')
      .leftJoinAndSelect('purchase.receiver', 'receiver')
      .leftJoinAndSelect('purchase.creator', 'creator')
      .leftJoinAndSelect('purchase.items', 'items')
      .leftJoinAndSelect('items.inventoryItem', 'inventoryItem')
      .where('purchase.tenantId = :tenantId', { tenantId });

    if (query.status) {
      qb.andWhere('purchase.status = :status', { status: query.status });
    }

    if (query.outletId) {
      qb.andWhere('purchase.outletId = :outletId', {
        outletId: query.outletId,
      });
    }

    if (query.supplierId) {
      qb.andWhere('purchase.supplierId = :supplierId', {
        supplierId: query.supplierId,
      });
    }

    if (query.startDate) {
      qb.andWhere('purchase.purchaseDate >= :startDate', {
        startDate: new Date(query.startDate),
      });
    }

    if (query.endDate) {
      qb.andWhere('purchase.purchaseDate <= :endDate', {
        endDate: new Date(query.endDate),
      });
    }

    if (query.search) {
      qb.andWhere(
        '(LOWER(purchase.purchaseNumber) LIKE LOWER(:search) OR LOWER(supplier.name) LIKE LOWER(:search))',
        { search: `%${query.search}%` },
      );
    }

    qb.orderBy('purchase.createdAt', 'DESC');
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
   * Get purchase detail by ID
   */
  async findById(tenantId: string, id: string): Promise<Purchase> {
    const purchase = await this.purchaseRepository.findOne({
      where: { id, tenantId },
      relations: {
        outlet: true,
        supplier: true,
        receiver: true,
        creator: true,
        items: {
          inventoryItem: true,
        },
      },
    });

    if (!purchase) {
      throw new NotFoundException({
        success: false,
        message: 'Purchase not found',
        code: 'PURCHASE_NOT_FOUND',
      });
    }

    return purchase;
  }

  /**
   * Generate next purchase number (PB-YYYY-XXXX)
   */
  private async generatePurchaseNumber(tenantId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `PB-${year}-`;

    const lastPurchase = await this.purchaseRepository
      .createQueryBuilder('p')
      .where('p.tenantId = :tenantId', { tenantId })
      .andWhere('p.purchaseNumber LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('p.createdAt', 'DESC')
      .getOne();

    let seq = 1;
    if (lastPurchase?.purchaseNumber) {
      const parts = lastPurchase.purchaseNumber.split('-');
      const lastSeq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastSeq)) {
        seq = lastSeq + 1;
      }
    }

    return `${prefix}${String(seq).padStart(3, '0')}`;
  }

  /**
   * Create a new purchase in DRAFT status (Stock & Unit Cost NOT affected yet)
   */
  async create(
    tenantId: string,
    actorId: string,
    dto: CreatePurchaseDto,
  ): Promise<Purchase> {
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

    const supplier = await this.supplierRepository.findOne({
      where: { id: dto.supplierId, tenantId },
    });
    if (!supplier) {
      throw new BadRequestException({
        success: false,
        message: 'Supplier not found or does not belong to this tenant',
        code: 'SUPPLIER_NOT_FOUND',
      });
    }

    // Validate inventory items
    for (const itemDto of dto.items) {
      const item = await this.inventoryItemRepository.findOne({
        where: { id: itemDto.inventoryItemId, tenantId },
      });
      if (!item) {
        throw new BadRequestException({
          success: false,
          message: `Inventory item ${itemDto.inventoryItemId} not found or does not belong to this tenant`,
          code: 'INVENTORY_ITEM_NOT_FOUND',
        });
      }
    }

    const purchaseNumber =
      dto.purchaseNumber || (await this.generatePurchaseNumber(tenantId));

    let subtotal = 0;
    const purchaseItems: PurchaseItem[] = [];

    for (const itemDto of dto.items) {
      const itemSubtotal = itemDto.quantityOrdered * itemDto.unitCost;
      subtotal += itemSubtotal;

      const item = this.purchaseItemRepository.create({
        tenantId,
        inventoryItemId: itemDto.inventoryItemId,
        quantityOrdered: itemDto.quantityOrdered,
        quantityReceived: 0,
        unitCost: itemDto.unitCost,
        subtotal: itemSubtotal,
      });
      purchaseItems.push(item);
    }

    const purchase = this.purchaseRepository.create({
      tenantId,
      outletId: dto.outletId,
      supplierId: dto.supplierId,
      purchaseNumber,
      purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate) : new Date(),
      status: 'DRAFT',
      totalItems: purchaseItems.length,
      subtotal,
      totalAmount: subtotal,
      notes: dto.notes ?? null,
      createdBy: actorId,
      items: purchaseItems,
    });

    const saved = await this.purchaseRepository.save(purchase);

    await this.audit.record({
      action: 'PURCHASE_CREATED',
      tenantId,
      actorType: 'USER',
      actorId,
      metadata: {
        purchaseId: saved.id,
        purchaseNumber: saved.purchaseNumber,
        supplierId: saved.supplierId,
        outletId: saved.outletId,
        totalAmount: saved.totalAmount,
      },
    });

    return this.findById(tenantId, saved.id);
  }

  /**
   * Update a purchase (allowed ONLY in DRAFT status)
   */
  async update(
    tenantId: string,
    id: string,
    actorId: string,
    dto: UpdatePurchaseDto,
  ): Promise<Purchase> {
    const purchase = await this.findById(tenantId, id);

    if (purchase.status !== 'DRAFT') {
      throw new BadRequestException({
        success: false,
        message: 'Only DRAFT purchases can be updated',
        code: 'PURCHASE_IMMUTABLE',
      });
    }

    if (dto.outletId) {
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
      purchase.outletId = dto.outletId;
    }

    if (dto.supplierId) {
      const supplier = await this.supplierRepository.findOne({
        where: { id: dto.supplierId, tenantId },
      });
      if (!supplier) {
        throw new BadRequestException({
          success: false,
          message: 'Supplier not found or does not belong to this tenant',
          code: 'SUPPLIER_NOT_FOUND',
        });
      }
      purchase.supplierId = dto.supplierId;
    }

    if (dto.purchaseDate) {
      purchase.purchaseDate = new Date(dto.purchaseDate);
    }

    if (dto.notes !== undefined) {
      purchase.notes = dto.notes ?? null;
    }

    if (dto.items && dto.items.length > 0) {
      // Remove old items
      await this.purchaseItemRepository.delete({ purchaseId: purchase.id });

      let subtotal = 0;
      const newItems: PurchaseItem[] = [];

      for (const itemDto of dto.items) {
        const itemSubtotal = itemDto.quantityOrdered * itemDto.unitCost;
        subtotal += itemSubtotal;

        const item = this.purchaseItemRepository.create({
          tenantId,
          purchaseId: purchase.id,
          inventoryItemId: itemDto.inventoryItemId,
          quantityOrdered: itemDto.quantityOrdered,
          quantityReceived: 0,
          unitCost: itemDto.unitCost,
          subtotal: itemSubtotal,
        });
        newItems.push(item);
      }

      purchase.items = newItems;
      purchase.totalItems = newItems.length;
      purchase.subtotal = subtotal;
      purchase.totalAmount = subtotal;
    }

    await this.purchaseRepository.save(purchase);

    await this.audit.record({
      action: 'PURCHASE_UPDATED',
      tenantId,
      actorType: 'USER',
      actorId,
      metadata: {
        purchaseId: purchase.id,
        updatedFields: Object.keys(dto),
      },
    });

    return this.findById(tenantId, purchase.id);
  }

  /**
   * Delete / Cancel draft purchase
   */
  async delete(
    tenantId: string,
    id: string,
    actorId: string,
  ): Promise<{ success: boolean; message: string }> {
    const purchase = await this.findById(tenantId, id);

    if (purchase.status !== 'DRAFT') {
      throw new BadRequestException({
        success: false,
        message: 'Only DRAFT purchases can be deleted',
        code: 'PURCHASE_IMMUTABLE',
      });
    }

    await this.purchaseRepository.softRemove(purchase);

    await this.audit.record({
      action: 'PURCHASE_DELETED',
      tenantId,
      actorType: 'USER',
      actorId,
      metadata: {
        purchaseId: purchase.id,
        purchaseNumber: purchase.purchaseNumber,
      },
    });

    return {
      success: true,
      message: 'Purchase deleted successfully',
    };
  }

  /**
   * Receive goods for a purchase:
   * 1. Increments physical stock in inventory_stocks for outlet
   * 2. Logs movement in inventory_movements
   * 3. Calculates Cumulative Average Unit Cost (Total Paid / Total Qty Bought) and updates inventory_items.unit_cost
   * 4. Locks purchase to RECEIVED status
   */
  async receive(
    tenantId: string,
    id: string,
    actorId: string,
    dto?: ReceivePurchaseDto,
  ): Promise<Purchase> {
    const purchase = await this.findById(tenantId, id);

    if (purchase.status !== 'DRAFT') {
      throw new BadRequestException({
        success: false,
        message: 'Only DRAFT purchases can be received',
        code: 'PURCHASE_NOT_DRAFT',
      });
    }

    await this.dataSource.transaction(async (manager) => {
      const purchaseRepo = manager.getRepository(Purchase);
      const purchaseItemRepo = manager.getRepository(PurchaseItem);
      const stockRepo = manager.getRepository(InventoryStock);
      const movementRepo = manager.getRepository(InventoryMovement);
      const itemRepo = manager.getRepository(InventoryItem);
      const pkgRepo = manager.getRepository(Packaging);

      const affectedItemIds = new Set<string>();

      for (const item of purchase.items) {
        // Determine quantity received
        let qtyReceived = Number(item.quantityOrdered);
        if (dto?.items && dto.items.length > 0) {
          const match = dto.items.find((i) => i.itemId === item.id);
          if (match && match.quantityReceived !== undefined) {
            qtyReceived = Number(match.quantityReceived);
          }
        }

        item.quantityReceived = qtyReceived;
        item.subtotal = qtyReceived * Number(item.unitCost);
        await purchaseItemRepo.save(item);

        affectedItemIds.add(item.inventoryItemId);

        // 1. Increment inventory physical stock at outlet
        let stock = await stockRepo.findOne({
          where: {
            tenantId,
            outletId: purchase.outletId,
            inventoryItemId: item.inventoryItemId,
          },
        });

        if (!stock) {
          stock = stockRepo.create({
            tenantId,
            outletId: purchase.outletId,
            inventoryItemId: item.inventoryItemId,
            quantity: qtyReceived,
          });
        } else {
          stock.quantity = Number(stock.quantity) + qtyReceived;
        }
        await stockRepo.save(stock);

        // 2. Log inventory stock movement
        const movement = movementRepo.create({
          tenantId,
          outletId: purchase.outletId,
          inventoryItemId: item.inventoryItemId,
          movementType: 'IN',
          referenceType: 'PURCHASE',
          referenceId: purchase.purchaseNumber,
          quantity: qtyReceived,
          notes: `Penerimaan Pembelian ${purchase.purchaseNumber} dari ${purchase.supplier?.name || 'Supplier'}`,
          movementDate: new Date(),
          createdBy: actorId,
        });
        await movementRepo.save(movement);
      }

      // Mark purchase status as RECEIVED before recalculating aggregate
      purchase.status = 'RECEIVED';
      purchase.receivedAt = new Date();
      purchase.receivedBy = actorId;
      if (dto?.notes) {
        purchase.notes = dto.notes;
      }
      await purchaseRepo.save(purchase);

      // 3. Recalculate Cumulative Average Unit Cost for all affected items
      for (const inventoryItemId of affectedItemIds) {
        const aggregateResult = await purchaseItemRepo
          .createQueryBuilder('pi')
          .innerJoin('pi.purchase', 'p')
          .select('SUM(pi.quantityReceived * pi.unitCost)', 'totalCost')
          .addSelect('SUM(pi.quantityReceived)', 'totalQty')
          .where('pi.tenantId = :tenantId', { tenantId })
          .andWhere('pi.inventoryItemId = :inventoryItemId', {
            inventoryItemId,
          })
          .andWhere('p.status = :status', { status: 'RECEIVED' })
          .getRawOne<{
            totalCost?: string | number;
            totalQty?: string | number;
          }>();

        const totalCost = Number(aggregateResult?.totalCost || 0);
        const totalQty = Number(aggregateResult?.totalQty || 0);

        if (totalQty > 0) {
          const cumulativeUnitCost =
            Math.round((totalCost / totalQty) * 100) / 100;

          await itemRepo.update(
            { id: inventoryItemId, tenantId },
            { unitCost: cumulativeUnitCost },
          );

          // Also update packaging costPrice if any packaging uses this inventory item
          await pkgRepo.update(
            { inventoryItemId, tenantId },
            { costPrice: cumulativeUnitCost },
          );
        }
      }
    });

    await this.audit.record({
      action: 'PURCHASE_RECEIVED',
      tenantId,
      actorType: 'USER',
      actorId,
      metadata: {
        purchaseId: purchase.id,
        purchaseNumber: purchase.purchaseNumber,
        supplierId: purchase.supplierId,
        totalItems: purchase.items.length,
      },
    });

    return this.findById(tenantId, purchase.id);
  }
}
