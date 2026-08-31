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
import { AuditLog } from '../../audit/audit-log.entity';
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
    private readonly dataSource: DataSource,
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

    const discountAmount = Number(dto.discountAmount ?? 0);
    const taxAmount = Number(dto.taxAmount ?? 0);
    const totalAmount = Math.max(
      calculatedSubtotal - discountAmount + taxAmount,
      0,
    );

    return this.dataSource.transaction(async (manager) => {
      const orderRepo = manager.getRepository(Order);
      const itemRepo = manager.getRepository(OrderItem);
      const auditRepo = manager.getRepository(AuditLog);

      const orderNumber = this.generateOrderNumber();

      const order = orderRepo.create({
        tenantId,
        outletId: targetOutletId,
        orderNumber,
        status: 'PENDING',
        orderType: dto.orderType ?? 'DINE_IN',
        tableNumber: dto.tableNumber ?? null,
        customerName: dto.customerName ?? null,
        subtotal: calculatedSubtotal,
        discountAmount,
        taxAmount,
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

      await itemRepo.save(items);

      await auditRepo.save({
        tenantId,
        actorType: 'USER',
        actorId: userId,
        action: 'ORDER_CREATED',
        metadata: {
          orderId: savedOrder.id,
          orderNumber: savedOrder.orderNumber,
          totalAmount: savedOrder.totalAmount,
        },
      });

      return orderRepo.findOne({
        where: { id: savedOrder.id, tenantId },
        relations: { items: true, outlet: true, creator: true },
      });
    });
  }

  async findAll(tenantId: string, query: QueryOrderDto) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20;
    const skip = (page - 1) * limit;

    const qb = this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.items', 'item')
      .leftJoinAndSelect('order.outlet', 'outlet')
      .leftJoinAndSelect('order.creator', 'creator')
      .leftJoinAndSelect('order.payments', 'payment')
      .leftJoinAndSelect('order.transaction', 'transaction')
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

    if (order.status === 'VOID') {
      throw new BadRequestException({
        success: false,
        message: 'Order is already voided',
        code: 'ALREADY_VOIDED',
      });
    }

    return this.dataSource.transaction(async (manager) => {
      const orderRepo = manager.getRepository(Order);
      const voidRepo = manager.getRepository(Void);
      const auditRepo = manager.getRepository(AuditLog);

      order.status = 'VOID';
      await orderRepo.save(order);

      const voidRecord = voidRepo.create({
        tenantId,
        outletId: order.outletId,
        orderId: order.id,
        reasonCategoryId: dto.reasonCategoryId ?? null,
        reason: dto.reason,
        voidedBy: userId,
      });

      const savedVoid = await voidRepo.save(voidRecord);

      await auditRepo.save({
        tenantId,
        actorType: 'USER',
        actorId: userId,
        action: 'ORDER_VOIDED',
        metadata: {
          orderId: order.id,
          voidId: savedVoid.id,
          reason: dto.reason,
        },
      });

      return {
        order,
        void: savedVoid,
      };
    });
  }
}

