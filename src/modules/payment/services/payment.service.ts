import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Payment } from '../entities/payment.entity';
import { Transaction } from '../entities/transaction.entity';
import { Order } from '../../order/entities/order.entity';
import { Recipe } from '../../recipe/entities/recipe.entity';
import { InventoryStock } from '../../inventory/entities/inventory-stock.entity';
import { InventoryMovement } from '../../inventory/entities/inventory-movement.entity';
import { Table } from '../../table/entities/table.entity';
import { AuditService } from '../../audit/audit.service';
import {
  CreatePaymentDto,
  GenerateQrisDto,
  QueryPaymentDto,
  QueryTransactionDto,
} from '../dto/payment.dto';
import { SettingsService } from '../../settings/services/settings.service';
import { QRIS_PROVIDER_TOKEN } from '../interfaces/qris-provider.interface';
import type { IQrisProvider } from '../interfaces/qris-provider.interface';

@Injectable()
export class PaymentService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @Inject(QRIS_PROVIDER_TOKEN)
    private readonly qrisProvider: IQrisProvider,
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
    private readonly settingsService: SettingsService,
  ) {}

  private generateTransactionNumber(): string {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `TRX-${dateStr}-${rand}`;
  }

  private async executeSettlement(
    manager: EntityManager,
    payment: Payment,
    order: Order,
    userId?: string | null,
  ) {
    const trxRepo = manager.getRepository(Transaction);
    const orderRepo = manager.getRepository(Order);
    const recipeRepo = manager.getRepository(Recipe);
    const stockRepo = manager.getRepository(InventoryStock);
    const movementRepo = manager.getRepository(InventoryMovement);
    const tableRepo = manager.getRepository(Table);

    const orderTotal = Number(order.totalAmount);
    const transactionNumber = this.generateTransactionNumber();
    const transaction = trxRepo.create({
      tenantId: order.tenantId,
      outletId: order.outletId,
      orderId: order.id,
      paymentId: payment.id,
      transactionNumber,
      amount: orderTotal,
      status: 'COMPLETED',
      completedAt: new Date(),
    });
    const savedTrx = await trxRepo.save(transaction);

    order.status = 'COMPLETED';
    order.completedAt = new Date();
    await orderRepo.save(order);

    // Release table if order was assigned to a table
    if (order.tableId) {
      const table = await tableRepo.findOne({
        where: { id: order.tableId, tenantId: order.tenantId },
      });
      if (table && table.status === 'OCCUPIED') {
        table.status = 'AVAILABLE';
        await tableRepo.save(table);
      }
    }

    // Automatic Recipe-based Stock Deduction
    for (const item of order.items ?? []) {
      const recipes = await recipeRepo.find({
        where: { tenantId: order.tenantId, variantId: item.variantId },
      });

      for (const recipe of recipes) {
        const deductionQty = Number(item.quantity) * Number(recipe.quantity);

        let stock = await stockRepo.findOne({
          where: {
            tenantId: order.tenantId,
            outletId: order.outletId,
            inventoryItemId: recipe.inventoryItemId,
          },
        });

        if (!stock) {
          stock = stockRepo.create({
            tenantId: order.tenantId,
            outletId: order.outletId,
            inventoryItemId: recipe.inventoryItemId,
            quantity: -deductionQty,
          });
        } else {
          stock.quantity = Number(stock.quantity) - deductionQty;
        }
        await stockRepo.save(stock);

        const movement = movementRepo.create({
          tenantId: order.tenantId,
          outletId: order.outletId,
          inventoryItemId: recipe.inventoryItemId,
          movementType: 'SALE',
          quantity: deductionQty,
          referenceType: 'ORDER',
          referenceId: order.id,
          notes: `Sold via Order ${order.orderNumber} (${item.productName} - ${item.variantName})`,
          movementDate: new Date(),
          createdBy: userId ?? null,
        });
        await movementRepo.save(movement);
      }
    }

    await this.audit.record(
      {
        action: 'PAYMENT_PROCESSED',
        tenantId: order.tenantId,
        actorType: userId ? 'USER' : 'SYSTEM',
        actorId: userId ?? 'SYSTEM',
        metadata: {
          orderId: order.id,
          paymentId: payment.id,
          transactionId: savedTrx.id,
          transactionNumber: savedTrx.transactionNumber,
          totalAmount: orderTotal,
          paymentMethod: payment.paymentMethod,
        },
      },
      manager,
    );

    return {
      payment,
      transaction: savedTrx,
      order,
    };
  }

  async create(tenantId: string, userId: string, dto: CreatePaymentDto) {
    const order = await this.orderRepository.findOne({
      where: { id: dto.orderId, tenantId },
      relations: { items: true, outlet: true },
    });

    if (!order) {
      throw new NotFoundException({
        success: false,
        message: 'Order not found',
        code: 'ORDER_NOT_FOUND',
      });
    }

    if (order.status === 'COMPLETED' || order.status === 'PAID') {
      throw new BadRequestException({
        success: false,
        message: 'Order is already paid and completed',
        code: 'ORDER_ALREADY_PAID',
      });
    }

    if (order.status === 'VOID' || order.status === 'CANCELLED') {
      throw new BadRequestException({
        success: false,
        message: `Cannot process payment for an order with status ${order.status}`,
        code: 'ORDER_INACTIVE',
      });
    }

    const settings = await this.settingsService.getSettings(
      tenantId,
      order.outletId,
    );
    if (dto.paymentMethod === 'CASH' && !settings.cashEnabled) {
      throw new BadRequestException({
        success: false,
        message: 'Cash payment is disabled for this outlet',
        code: 'PAYMENT_METHOD_DISABLED',
      });
    }
    if (dto.paymentMethod === 'QRIS' && !settings.qrisEnabled) {
      throw new BadRequestException({
        success: false,
        message: 'QRIS payment is disabled for this outlet',
        code: 'PAYMENT_METHOD_DISABLED',
      });
    }

    const orderTotal = Number(order.totalAmount);
    if (dto.amount < orderTotal) {
      throw new BadRequestException({
        success: false,
        message: `Payment amount (${dto.amount}) is less than order total (${orderTotal})`,
        code: 'INSUFFICIENT_PAYMENT',
      });
    }

    const changeAmount =
      dto.paymentMethod === 'CASH' ? dto.amount - orderTotal : 0;

    return this.dataSource.transaction(async (manager) => {
      const paymentRepo = manager.getRepository(Payment);

      const payment = paymentRepo.create({
        tenantId,
        outletId: order.outletId,
        orderId: order.id,
        paymentMethod: dto.paymentMethod,
        amount: dto.amount,
        changeAmount,
        status: 'SUCCESS',
        referenceNumber: dto.referenceNumber ?? null,
        paidAt: new Date(),
        createdBy: userId,
      });
      const savedPayment = await paymentRepo.save(payment);

      return this.executeSettlement(manager, savedPayment, order, userId);
    });
  }

  async generateQris(tenantId: string, userId: string, dto: GenerateQrisDto) {
    const order = await this.orderRepository.findOne({
      where: { id: dto.orderId, tenantId },
      relations: { items: true, outlet: true },
    });

    if (!order) {
      throw new NotFoundException({
        success: false,
        message: 'Order not found',
        code: 'ORDER_NOT_FOUND',
      });
    }

    if (order.status === 'COMPLETED' || order.status === 'PAID') {
      throw new BadRequestException({
        success: false,
        message: 'Order is already paid and completed',
        code: 'ORDER_ALREADY_PAID',
      });
    }

    if (order.status === 'VOID' || order.status === 'CANCELLED') {
      throw new BadRequestException({
        success: false,
        message: `Cannot process payment for an order with status ${order.status}`,
        code: 'ORDER_INACTIVE',
      });
    }

    const settings = await this.settingsService.getSettings(
      tenantId,
      order.outletId,
    );
    if (!settings.qrisEnabled) {
      throw new BadRequestException({
        success: false,
        message: 'QRIS payment is disabled for this outlet',
        code: 'PAYMENT_METHOD_DISABLED',
      });
    }

    const now = new Date();
    const existingPending = await this.paymentRepository.findOne({
      where: {
        orderId: order.id,
        tenantId,
        paymentMethod: 'QRIS',
        status: 'PENDING',
      },
      order: { createdAt: 'DESC' },
    });

    if (
      existingPending &&
      existingPending.expiresAt &&
      existingPending.expiresAt > now
    ) {
      return {
        payment: existingPending,
        order,
        qrString: existingPending.qrString,
        qrUrl: existingPending.qrUrl,
        expiresAt: existingPending.expiresAt,
      };
    }

    if (existingPending) {
      existingPending.status = 'EXPIRED';
      await this.paymentRepository.save(existingPending);
    }

    const qrisResult = await this.qrisProvider.generateQris({
      tenantId,
      orderId: order.id,
      orderNumber: order.orderNumber,
      amount: Number(order.totalAmount),
      customerName: order.customerName,
      expiryMinutes: 15,
    });

    const payment = this.paymentRepository.create({
      tenantId,
      outletId: order.outletId,
      orderId: order.id,
      paymentMethod: 'QRIS',
      amount: Number(order.totalAmount),
      changeAmount: 0,
      status: 'PENDING',
      paidAt: null,
      qrString: qrisResult.qrString,
      qrUrl: qrisResult.qrUrl ?? null,
      expiresAt: qrisResult.expiresAt,
      gatewayProvider: qrisResult.gatewayProvider,
      gatewayReference: qrisResult.gatewayReference,
      referenceNumber: qrisResult.gatewayReference,
      createdBy: userId,
    });

    const savedPayment = await this.paymentRepository.save(payment);

    return {
      payment: savedPayment,
      order,
      qrString: qrisResult.qrString,
      qrUrl: qrisResult.qrUrl,
      expiresAt: qrisResult.expiresAt,
    };
  }

  async getQrisStatus(tenantId: string, orderId: string) {
    const payment = await this.paymentRepository.findOne({
      where: { orderId, tenantId, paymentMethod: 'QRIS' },
      order: { createdAt: 'DESC' },
    });

    if (!payment) {
      throw new NotFoundException({
        success: false,
        message: 'QRIS payment not found for this order',
        code: 'PAYMENT_NOT_FOUND',
      });
    }

    if (
      payment.status === 'PENDING' &&
      payment.expiresAt &&
      payment.expiresAt <= new Date()
    ) {
      payment.status = 'EXPIRED';
      await this.paymentRepository.save(payment);
    }

    return {
      paymentId: payment.id,
      orderId: payment.orderId,
      status: payment.status,
      amount: Number(payment.amount),
      expiresAt: payment.expiresAt,
      paidAt: payment.paidAt,
    };
  }

  async settlePayment(
    paymentId: string,
    tenantId: string,
    userId?: string | null,
    paidAt: Date = new Date(),
  ) {
    return this.dataSource.transaction(async (manager) => {
      const paymentRepo = manager.getRepository(Payment);
      const orderRepo = manager.getRepository(Order);

      const payment = await paymentRepo
        .createQueryBuilder('p')
        .setLock('pessimistic_write')
        .where('p.id = :id AND p.tenantId = :tenantId', {
          id: paymentId,
          tenantId,
        })
        .getOne();

      if (!payment) {
        throw new NotFoundException({
          success: false,
          message: 'Payment not found',
          code: 'PAYMENT_NOT_FOUND',
        });
      }

      if (payment.status === 'SUCCESS') {
        return {
          success: true,
          message: 'Payment is already settled',
          payment,
        };
      }

      payment.status = 'SUCCESS';
      payment.paidAt = paidAt;
      const savedPayment = await paymentRepo.save(payment);

      const order = await orderRepo.findOne({
        where: { id: payment.orderId, tenantId },
        relations: { items: true, outlet: true },
      });

      if (!order) {
        throw new NotFoundException({
          success: false,
          message: 'Order not found for payment',
          code: 'ORDER_NOT_FOUND',
        });
      }

      return this.executeSettlement(manager, savedPayment, order, userId);
    });
  }

  async checkQrisStatus(tenantId: string, userId: string, orderId: string) {
    const payment = await this.paymentRepository.findOne({
      where: { orderId, tenantId, paymentMethod: 'QRIS' },
      order: { createdAt: 'DESC' },
    });

    if (!payment) {
      throw new NotFoundException({
        success: false,
        message: 'QRIS payment not found for this order',
        code: 'PAYMENT_NOT_FOUND',
      });
    }

    if (payment.status === 'SUCCESS') {
      return {
        success: true,
        message: 'Payment is already completed',
        status: 'SUCCESS',
        payment,
      };
    }

    if (!payment.gatewayReference) {
      return {
        success: false,
        message: 'Payment has no gateway reference',
        status: payment.status,
      };
    }

    const gatewayStatus = await this.qrisProvider.checkStatus(
      payment.gatewayReference,
    );

    if (gatewayStatus.status === 'SUCCESS') {
      return this.settlePayment(
        payment.id,
        tenantId,
        userId,
        gatewayStatus.paidAt ?? new Date(),
      );
    }

    if (gatewayStatus.status === 'EXPIRED') {
      payment.status = 'EXPIRED';
      await this.paymentRepository.save(payment);
    } else if (gatewayStatus.status === 'FAILED') {
      payment.status = 'FAILED';
      await this.paymentRepository.save(payment);
    }

    return {
      success: true,
      status: payment.status,
      payment,
    };
  }

  async processGatewayWebhook(
    headers: Record<string, string | string[] | undefined>,
    payload: Record<string, unknown>,
  ) {
    const isValid = this.qrisProvider.verifyWebhookSignature(headers, payload);
    if (!isValid) {
      throw new BadRequestException({
        success: false,
        message: 'Invalid webhook signature',
        code: 'INVALID_SIGNATURE',
      });
    }

    const result = this.qrisProvider.parseWebhookPayload(payload);

    const payment = await this.paymentRepository.findOne({
      where: { gatewayReference: result.gatewayReference },
    });

    if (!payment) {
      return {
        success: true,
        message: 'Payment not found for gateway reference, ignored',
      };
    }

    if (result.status === 'SUCCESS') {
      return this.settlePayment(
        payment.id,
        payment.tenantId,
        null,
        result.paidAt ?? new Date(),
      );
    }

    if (result.status === 'EXPIRED') {
      payment.status = 'EXPIRED';
      await this.paymentRepository.save(payment);
    } else if (result.status === 'FAILED') {
      payment.status = 'FAILED';
      await this.paymentRepository.save(payment);
    }

    return {
      success: true,
      status: payment.status,
    };
  }

  async simulateQrisPayment(
    tenantId: string,
    userId: string,
    paymentId: string,
  ) {
    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId, tenantId },
    });

    if (!payment) {
      throw new NotFoundException({
        success: false,
        message: 'Payment not found',
        code: 'PAYMENT_NOT_FOUND',
      });
    }

    if (payment.status !== 'PENDING') {
      throw new BadRequestException({
        success: false,
        message: `Payment status is ${payment.status}, cannot simulate payment`,
        code: 'INVALID_PAYMENT_STATUS',
      });
    }

    return this.settlePayment(payment.id, tenantId, userId, new Date());
  }

  async findPayments(tenantId: string, query: QueryPaymentDto) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit =
      query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20;
    const skip = (page - 1) * limit;

    const qb = this.paymentRepository
      .createQueryBuilder('payment')
      .leftJoinAndSelect('payment.order', 'order')
      .leftJoinAndSelect('payment.outlet', 'outlet')
      .leftJoinAndSelect('payment.creator', 'creator')
      .where('payment.tenantId = :tenantId', { tenantId });

    if (query.outletId) {
      qb.andWhere('payment.outletId = :outletId', {
        outletId: query.outletId,
      });
    }

    if (query.paymentMethod) {
      qb.andWhere('payment.paymentMethod = :paymentMethod', {
        paymentMethod: query.paymentMethod,
      });
    }

    if (query.status) {
      qb.andWhere('payment.status = :status', { status: query.status });
    }

    if (query.startDate) {
      qb.andWhere('payment.createdAt >= :startDate', {
        startDate: new Date(query.startDate),
      });
    }

    if (query.endDate) {
      qb.andWhere('payment.createdAt <= :endDate', {
        endDate: new Date(query.endDate),
      });
    }

    qb.orderBy('payment.createdAt', 'DESC');
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

  async findTransactions(tenantId: string, query: QueryTransactionDto) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit =
      query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20;
    const skip = (page - 1) * limit;

    const qb = this.transactionRepository
      .createQueryBuilder('trx')
      .leftJoinAndSelect('trx.order', 'order')
      .leftJoinAndSelect('trx.payment', 'payment')
      .leftJoinAndSelect('trx.outlet', 'outlet')
      .where('trx.tenantId = :tenantId', { tenantId });

    if (query.outletId) {
      qb.andWhere('trx.outletId = :outletId', { outletId: query.outletId });
    }

    if (query.status) {
      qb.andWhere('trx.status = :status', { status: query.status });
    }

    if (query.startDate) {
      qb.andWhere('trx.completedAt >= :startDate', {
        startDate: new Date(query.startDate),
      });
    }

    if (query.endDate) {
      qb.andWhere('trx.completedAt <= :endDate', {
        endDate: new Date(query.endDate),
      });
    }

    if (query.search) {
      qb.andWhere('(LOWER(trx.transactionNumber) LIKE LOWER(:search))', {
        search: `%${query.search}%`,
      });
    }

    qb.orderBy('trx.completedAt', 'DESC');
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

  async findTransactionById(tenantId: string, id: string) {
    const trx = await this.transactionRepository.findOne({
      where: { id, tenantId },
      relations: {
        order: { items: true },
        payment: true,
        outlet: true,
      },
    });

    if (!trx) {
      throw new NotFoundException({
        success: false,
        message: 'Transaction not found',
        code: 'TRANSACTION_NOT_FOUND',
      });
    }

    return trx;
  }
}
