import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Order } from '../entities/order.entity';
import { OrderItem } from '../entities/order-item.entity';
import { Void } from '../entities/void.entity';
import { Outlet } from '../../outlet/outlet.entity';
import { ProductVariant } from '../../product/entities/product-variant.entity';
import { Table } from '../../table/entities/table.entity';
import { Recipe } from '../../recipe/entities/recipe.entity';
import { InventoryStock } from '../../inventory/entities/inventory-stock.entity';
import { InventoryMovement } from '../../inventory/entities/inventory-movement.entity';
import { AuditService } from '../../audit/audit.service';
import { SettingsService } from '../../settings/services/settings.service';
import { DiscountService } from '../../settings/services/discount.service';
import { PackagingService } from '../../packaging/services/packaging.service';
import {
  CreateOrderDto,
  QueryOrderDto,
  UpdateOrderDto,
  VoidOrderDto,
} from '../dto/order.dto';

@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemRepository: Repository<OrderItem>,
    @InjectRepository(Void)
    private readonly voidRepository: Repository<Void>,
    @InjectRepository(Outlet)
    private readonly outletRepository: Repository<Outlet>,
    @InjectRepository(ProductVariant)
    private readonly variantRepository: Repository<ProductVariant>,
    @InjectRepository(Table)
    private readonly tableRepository: Repository<Table>,
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
    private readonly settingsService: SettingsService,
    private readonly discountService: DiscountService,
    private readonly packagingService: PackagingService,
  ) {}

  private generateOrderNumber(): string {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `ORD-${dateStr}-${rand}`;
  }

  async create(
    tenantId: string,
    userId: string,
    outletId: string,
    dto: CreateOrderDto,
  ) {
    const targetOutletId = dto.outletId ?? outletId;
    if (!targetOutletId) {
      throw new BadRequestException({
        success: false,
        message: 'Outlet ID is required to create an order',
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

    const variantIds = dto.items.map((i) => i.variantId);
    const variants = await this.variantRepository.find({
      where: { id: In(variantIds), tenantId },
      relations: { product: true },
    });

    if (variants.length !== new Set(variantIds).size) {
      throw new BadRequestException({
        success: false,
        message:
          'One or more product variants do not exist or belong to another tenant',
        code: 'INVALID_VARIANTS',
      });
    }

    const variantMap = new Map(variants.map((v) => [v.id, v]));

    let calculatedSubtotal = 0;
    const orderItemsToCreate: Partial<OrderItem>[] = [];

    for (const itemDto of dto.items) {
      const variant = variantMap.get(itemDto.variantId);
      if (!variant) continue;

      const unitPrice = Number(variant.price);
      const discount = Number(itemDto.discountAmount ?? 0);
      const lineSubtotal = unitPrice * itemDto.quantity - discount;
      calculatedSubtotal += lineSubtotal;

      orderItemsToCreate.push({
        tenantId,
        productId: variant.productId,
        variantId: variant.id,
        productName: variant.product.name,
        variantName: variant.name,
        quantity: itemDto.quantity,
        unitPrice,
        discountAmount: discount,
        subtotal: Math.max(lineSubtotal, 0),
        notes: itemDto.notes ?? null,
        status: 'ACTIVE',
      });
    }

    const settings = await this.settingsService.getSettings(
      tenantId,
      targetOutletId,
    );

    let appliedDiscountId: string | null = null;
    let discountAmount = Number(dto.discountAmount ?? 0);

    if (dto.discountId) {
      const discount = await this.discountService.findById(
        tenantId,
        dto.discountId,
      );
      const activeCheck = this.discountService.isDiscountActive(
        discount,
        new Date(),
        calculatedSubtotal,
      );
      if (!activeCheck.isValid) {
        throw new BadRequestException({
          success: false,
          message: `Discount "${discount.name}" is not applicable: ${activeCheck.reason}`,
          code: 'DISCOUNT_NOT_APPLICABLE',
        });
      }
      discountAmount = this.discountService.calculateDiscount(
        discount,
        orderItemsToCreate.map((item) => ({
          productId: item.productId as string,
          unitPrice: Number(item.unitPrice),
          quantity: Number(item.quantity),
        })),
        calculatedSubtotal,
      );
      appliedDiscountId = discount.id;
    } else if (settings.discountEnabled && discountAmount === 0) {
      if (settings.discountType === 'PERCENTAGE') {
        discountAmount = Math.round(
          (calculatedSubtotal * Number(settings.discountValue)) / 100,
        );
      } else {
        discountAmount = Math.min(
          calculatedSubtotal,
          Number(settings.discountValue),
        );
      }
    }

    const orderType = dto.orderType ?? 'DINE_IN';

    if (orderType === 'TAKE_AWAY' && dto.tableId) {
      throw new BadRequestException({
        success: false,
        message: 'Table assignment is not allowed for TAKE_AWAY orders',
        code: 'TABLE_NOT_ALLOWED',
      });
    }

    let packagingFee = Number(dto.packagingFee ?? 0);
    if (orderType === 'TAKE_AWAY' && dto.packagingFee === undefined) {
      const applicablePackagings =
        await this.packagingService.findApplicableForOrder(
          tenantId,
          targetOutletId,
          orderType,
        );
      packagingFee = applicablePackagings.reduce(
        (sum, p) => sum + Number(p.extraPrice || 0),
        0,
      );
    }

    let taxAmount = 0;
    let isInclusiveTax = false;
    if (settings.taxEnabled) {
      const taxableBase = Math.max(calculatedSubtotal - discountAmount, 0);
      const activeTax = settings.defaultGlobalTax;
      const rate = activeTax
        ? Number(activeTax.rate)
        : Number(settings.taxRate || 0);
      const taxType = activeTax ? activeTax.type : 'EXCLUSIVE';

      if (taxType === 'INCLUSIVE' && rate > 0) {
        isInclusiveTax = true;
        taxAmount = Math.round(taxableBase - taxableBase / (1 + rate / 100));
      } else if (rate > 0) {
        taxAmount = Math.round((taxableBase * rate) / 100);
      }
    }

    const totalAmount = Math.max(
      calculatedSubtotal -
        discountAmount +
        packagingFee +
        (isInclusiveTax ? 0 : taxAmount),
      0,
    );

    let assignedTable: Table | null = null;
    if (dto.tableId) {
      assignedTable = await this.tableRepository.findOne({
        where: { id: dto.tableId, tenantId, outletId: targetOutletId },
      });

      if (!assignedTable) {
        throw new BadRequestException({
          success: false,
          message: 'Table not found or does not belong to this outlet',
          code: 'TABLE_NOT_FOUND',
        });
      }

      if (assignedTable.status !== 'AVAILABLE') {
        throw new BadRequestException({
          success: false,
          message: `Table "${assignedTable.tableNumber}" is not available (current status: ${assignedTable.status})`,
          code: 'TABLE_NOT_AVAILABLE',
        });
      }
    }

    return this.dataSource.transaction(async (manager) => {
      const orderRepo = manager.getRepository(Order);
      const itemRepo = manager.getRepository(OrderItem);
      const tableRepo = manager.getRepository(Table);

      if (assignedTable) {
        assignedTable.status = 'OCCUPIED';
        await tableRepo.save(assignedTable);
      }

      const orderNumber = this.generateOrderNumber();

      const order = orderRepo.create({
        tenantId,
        outletId: targetOutletId,
        orderNumber,
        status: 'PENDING',
        orderType,
        tableId: assignedTable ? assignedTable.id : null,
        tableNumber:
          dto.tableNumber ?? (assignedTable ? assignedTable.tableNumber : null),
        customerName: dto.customerName ?? null,
        subtotal: calculatedSubtotal,
        discountAmount,
        discountId: appliedDiscountId,
        taxAmount,
        packagingFee,
        totalAmount,
        notes: dto.notes ?? null,
        createdBy: userId,
      });

      const savedOrder = await orderRepo.save(order);

      const items = orderItemsToCreate.map((item) =>
        itemRepo.create({
          ...item,
          orderId: savedOrder.id,
        }),
      );

      const savedItems = await itemRepo.save(items);

      // Deduct raw materials for all items sent to station (recipes)
      const recipeRepo = manager.getRepository(Recipe);
      const stockRepo = manager.getRepository(InventoryStock);
      const movementRepo = manager.getRepository(InventoryMovement);

      for (const item of savedItems) {
        const recipes = await recipeRepo.find({
          where: { tenantId, variantId: item.variantId },
        });

        for (const recipe of recipes) {
          const deductionQty = Number(item.quantity) * Number(recipe.quantity);

          let stock = await stockRepo.findOne({
            where: {
              tenantId,
              outletId: targetOutletId,
              inventoryItemId: recipe.inventoryItemId,
            },
          });

          if (!stock) {
            stock = stockRepo.create({
              tenantId,
              outletId: targetOutletId,
              inventoryItemId: recipe.inventoryItemId,
              quantity: -deductionQty,
            });
          } else {
            stock.quantity = Number(stock.quantity) - deductionQty;
          }
          await stockRepo.save(stock);

          const movement = movementRepo.create({
            tenantId,
            outletId: targetOutletId,
            inventoryItemId: recipe.inventoryItemId,
            movementType: 'SALE',
            quantity: deductionQty,
            referenceType: 'ORDER',
            referenceId: savedOrder.id,
            notes: `Sent to station via Order ${savedOrder.orderNumber} (${item.productName} - ${item.variantName})`,
            movementDate: new Date(),
            createdBy: userId,
            metadata: {
              orderItemId: item.id,
              variantId: item.variantId,
            },
          });
          await movementRepo.save(movement);
        }
      }

      // Packaging-based stock deduction for TAKE_AWAY orders
      if (orderType === 'TAKE_AWAY') {
        const packagings = await this.packagingService.findApplicableForOrder(
          tenantId,
          targetOutletId,
          orderType,
        );

        for (const pkg of packagings) {
          if (!pkg.inventoryItemId) continue;

          let pStock = await stockRepo.findOne({
            where: {
              tenantId,
              outletId: targetOutletId,
              inventoryItemId: pkg.inventoryItemId,
            },
          });

          if (!pStock) {
            pStock = stockRepo.create({
              tenantId,
              outletId: targetOutletId,
              inventoryItemId: pkg.inventoryItemId,
              quantity: -1,
            });
          } else {
            pStock.quantity = Number(pStock.quantity) - 1;
          }
          await stockRepo.save(pStock);

          const pMovement = movementRepo.create({
            tenantId,
            outletId: targetOutletId,
            inventoryItemId: pkg.inventoryItemId,
            movementType: 'SALE',
            quantity: 1,
            referenceType: 'ORDER',
            referenceId: savedOrder.id,
            notes: `Takeaway packaging for Order ${savedOrder.orderNumber} (${pkg.name})`,
            movementDate: new Date(),
            createdBy: userId,
            metadata: {
              packagingId: pkg.id,
            },
          });
          await movementRepo.save(pMovement);
        }
      }

      await this.audit.record(
        {
          action: 'ORDER_CREATED',
          tenantId,
          actorType: 'USER',
          actorId: userId,
          metadata: {
            orderId: savedOrder.id,
            orderNumber: savedOrder.orderNumber,
            totalAmount: savedOrder.totalAmount,
            packagingFee: savedOrder.packagingFee,
            tableId: assignedTable?.id,
          },
        },
        manager,
      );

      return orderRepo.findOne({
        where: { id: savedOrder.id, tenantId },
        relations: { items: true, outlet: true, creator: true, table: true },
      });
    });
  }

  async findAll(tenantId: string, query: QueryOrderDto) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit =
      query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20;
    const skip = (page - 1) * limit;

    const qb = this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.items', 'item')
      .leftJoinAndSelect('order.outlet', 'outlet')
      .leftJoinAndSelect('order.creator', 'creator')
      .leftJoinAndSelect('order.payments', 'payment')
      .leftJoinAndSelect('order.transaction', 'transaction')
      .leftJoinAndSelect('order.table', 'table')
      .where('order.tenantId = :tenantId', { tenantId });

    if (query.outletId) {
      qb.andWhere('order.outletId = :outletId', { outletId: query.outletId });
    }

    if (query.status) {
      qb.andWhere('order.status = :status', { status: query.status });
    }

    if (query.orderType) {
      qb.andWhere('order.orderType = :orderType', {
        orderType: query.orderType,
      });
    }

    if (query.startDate) {
      qb.andWhere('order.createdAt >= :startDate', {
        startDate: new Date(query.startDate),
      });
    }

    if (query.endDate) {
      qb.andWhere('order.createdAt <= :endDate', {
        endDate: new Date(query.endDate),
      });
    }

    if (query.search) {
      qb.andWhere(
        '(LOWER(order.orderNumber) LIKE LOWER(:search) OR LOWER(order.customerName) LIKE LOWER(:search) OR LOWER(order.tableNumber) LIKE LOWER(:search))',
        { search: `%${query.search}%` },
      );
    }

    qb.orderBy('order.createdAt', 'DESC');
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
    const qb = this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.items', 'item')
      .leftJoinAndSelect('order.outlet', 'outlet')
      .leftJoinAndSelect('order.creator', 'creator')
      .leftJoinAndSelect('order.payments', 'payment')
      .leftJoinAndSelect('order.transaction', 'transaction')
      .leftJoinAndSelect('order.table', 'table')
      .where('order.id = :id AND order.tenantId = :tenantId', {
        id,
        tenantId,
      });

    if (outletId) {
      qb.andWhere('order.outletId = :outletId', { outletId });
    }

    const order = await qb.getOne();
    if (!order) {
      throw new NotFoundException({
        success: false,
        message: 'Order not found',
        code: 'ORDER_NOT_FOUND',
      });
    }

    return order;
  }

  async update(tenantId: string, id: string, dto: UpdateOrderDto) {
    const order = await this.findById(tenantId, id);

    if (order.status === 'COMPLETED' || order.status === 'VOID') {
      throw new BadRequestException({
        success: false,
        message: `Cannot modify an order with status ${order.status}`,
        code: 'ORDER_LOCKED',
      });
    }

    if (dto.tableNumber !== undefined) order.tableNumber = dto.tableNumber;
    if (dto.customerName !== undefined) order.customerName = dto.customerName;
    if (dto.notes !== undefined) order.notes = dto.notes;

    return this.orderRepository.save(order);
  }

  async void(
    tenantId: string,
    userId: string,
    outletId: string,
    id: string,
    dto: VoidOrderDto,
  ) {
    const order = await this.findById(tenantId, id);

    if (order.status === 'COMPLETED' || order.status === 'PAID') {
      throw new BadRequestException({
        success: false,
        message: 'Cannot void an order that has already been paid/completed',
        code: 'ORDER_LOCKED',
      });
    }

    if (order.status === 'VOID') {
      throw new BadRequestException({
        success: false,
        message: 'Order is already voided',
        code: 'ALREADY_VOIDED',
      });
    }

    const targetItem = order.items?.find((item) => item.id === dto.orderItemId);
    if (!targetItem) {
      throw new NotFoundException({
        success: false,
        message: 'Order item not found in this order',
        code: 'ITEM_NOT_FOUND',
      });
    }

    if (targetItem.status === 'VOID') {
      throw new BadRequestException({
        success: false,
        message: 'This menu item has already been voided',
        code: 'ITEM_ALREADY_VOIDED',
      });
    }

    return this.dataSource.transaction(async (manager) => {
      const orderRepo = manager.getRepository(Order);
      const itemRepo = manager.getRepository(OrderItem);
      const voidRepo = manager.getRepository(Void);
      const tableRepo = manager.getRepository(Table);
      const movementRepo = manager.getRepository(InventoryMovement);

      // 1. Mark item as VOID
      targetItem.status = 'VOID';
      await itemRepo.save(targetItem);

      // 2. Create Void record
      const voidRecord = voidRepo.create({
        tenantId,
        outletId: order.outletId,
        orderId: order.id,
        orderItemId: targetItem.id,
        reasonCategoryId: dto.reasonCategoryId ?? null,
        reason: dto.reason,
        voidedBy: userId,
      });
      const savedVoid = await voidRepo.save(voidRecord);

      // 3. Reclassify inventory movements for this voided menu item from SALE to WASTE
      // Raw materials were already deducted when the order was sent to the station,
      // so we do not deduct stock again or restore it. We update the movement record to WASTE.
      const movements = await movementRepo.find({
        where: {
          tenantId,
          outletId: order.outletId,
          referenceType: 'ORDER',
          referenceId: order.id,
        },
      });

      for (const movement of movements) {
        const meta = movement.metadata;
        if (meta && meta.orderItemId === targetItem.id) {
          movement.movementType = 'WASTE';
          movement.referenceType = 'VOID';
          movement.referenceId = savedVoid.id;
          movement.reasonCategoryId = dto.reasonCategoryId ?? null;
          movement.notes = `Void menu item: ${targetItem.productName} - ${targetItem.variantName} (${dto.reason})`;
          movement.metadata = {
            ...meta,
            voidId: savedVoid.id,
            voidReason: dto.reason,
          };
          await movementRepo.save(movement);
        }
      }

      // 4. Recalculate remaining active items in the order
      const activeItems = (order.items ?? []).filter(
        (i) => i.id !== targetItem.id && i.status === 'ACTIVE',
      );

      const calculatedSubtotal = activeItems.reduce(
        (sum, item) => sum + Number(item.subtotal),
        0,
      );

      const settings = await this.settingsService.getSettings(
        tenantId,
        order.outletId,
      );

      let discountAmount = 0;
      if (order.discountId && calculatedSubtotal > 0) {
        const discount = await this.discountService.findById(
          tenantId,
          order.discountId,
        );
        const activeCheck = this.discountService.isDiscountActive(
          discount,
          new Date(),
          calculatedSubtotal,
        );
        if (activeCheck.isValid) {
          discountAmount = this.discountService.calculateDiscount(
            discount,
            activeItems.map((item) => ({
              productId: item.productId,
              unitPrice: Number(item.unitPrice),
              quantity: Number(item.quantity),
            })),
            calculatedSubtotal,
          );
        }
      } else if (settings.discountEnabled && calculatedSubtotal > 0) {
        if (settings.discountType === 'PERCENTAGE') {
          discountAmount = Math.round(
            (calculatedSubtotal * Number(settings.discountValue)) / 100,
          );
        } else {
          discountAmount = Math.min(
            calculatedSubtotal,
            Number(settings.discountValue),
          );
        }
      }

      let packagingFee = Number(order.packagingFee ?? 0);
      if (order.orderType === 'TAKE_AWAY' && activeItems.length === 0) {
        packagingFee = 0;
      }

      let taxAmount = 0;
      let isInclusiveTax = false;
      if (settings.taxEnabled && calculatedSubtotal > 0) {
        const taxableBase = Math.max(calculatedSubtotal - discountAmount, 0);
        const activeTax = settings.defaultGlobalTax;
        const rate = activeTax
          ? Number(activeTax.rate)
          : Number(settings.taxRate || 0);
        const taxType = activeTax ? activeTax.type : 'EXCLUSIVE';

        if (taxType === 'INCLUSIVE' && rate > 0) {
          isInclusiveTax = true;
          taxAmount = Math.round(taxableBase - taxableBase / (1 + rate / 100));
        } else if (rate > 0) {
          taxAmount = Math.round((taxableBase * rate) / 100);
        }
      }

      const totalAmount = Math.max(
        calculatedSubtotal -
          discountAmount +
          packagingFee +
          (isInclusiveTax ? 0 : taxAmount),
        0,
      );

      order.subtotal = calculatedSubtotal;
      order.discountAmount = discountAmount;
      order.taxAmount = taxAmount;
      order.packagingFee = packagingFee;
      order.totalAmount = totalAmount;

      // If all items are voided, mark order as VOID and release table
      if (activeItems.length === 0) {
        order.status = 'VOID';
        if (order.tableId) {
          const table = await tableRepo.findOne({
            where: { id: order.tableId, tenantId },
          });
          if (table && table.status === 'OCCUPIED') {
            table.status = 'AVAILABLE';
            await tableRepo.save(table);
          }
        }
      }

      await orderRepo.save(order);

      await this.audit.record(
        {
          action: 'ORDER_ITEM_VOIDED',
          tenantId,
          actorType: 'USER',
          actorId: userId,
          metadata: {
            orderId: order.id,
            orderItemId: targetItem.id,
            productName: targetItem.productName,
            variantName: targetItem.variantName,
            voidId: savedVoid.id,
            reason: dto.reason,
            newTotalAmount: order.totalAmount,
            isWholeOrderVoided: activeItems.length === 0,
          },
        },
        manager,
      );

      return {
        order,
        voidedItem: targetItem,
        void: savedVoid,
      };
    });
  }
}
