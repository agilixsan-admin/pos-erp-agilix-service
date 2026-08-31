import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Payment } from '../entities/payment.entity';
import { Transaction } from '../entities/transaction.entity';
import { Order } from '../../order/entities/order.entity';
import { Recipe } from '../../recipe/entities/recipe.entity';
import { InventoryStock } from '../../inventory/entities/inventory-stock.entity';
import { InventoryMovement } from '../../inventory/entities/inventory-movement.entity';
import { AuditLog } from '../../audit/audit-log.entity';
import {
  CreatePaymentDto,
  QueryPaymentDto,
  QueryTransactionDto,
} from '../dto/payment.dto';

@Injectable()
export class PaymentService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly dataSource: DataSource,
  ) {}

  private generateTransactionNumber(): string {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `TRX-${dateStr}-${rand}`;
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
      const trxRepo = manager.getRepository(Transaction);
      const orderRepo = manager.getRepository(Order);
      const recipeRepo = manager.getRepository(Recipe);
      const stockRepo = manager.getRepository(InventoryStock);
      const movementRepo = manager.getRepository(InventoryMovement);
      const auditRepo = manager.getRepository(AuditLog);

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

      const transactionNumber = this.generateTransactionNumber();
      const transaction = trxRepo.create({
        tenantId,
        outletId: order.outletId,
        orderId: order.id,
        paymentId: savedPayment.id,
        transactionNumber,
        amount: orderTotal,
        status: 'COMPLETED',
        completedAt: new Date(),
      });
      const savedTrx = await trxRepo.save(transaction);

      order.status = 'COMPLETED';
      order.completedAt = new Date();
      await orderRepo.save(order);

      // Automatic Recipe-based Stock Deduction
      for (const item of order.items) {
        const recipes = await recipeRepo.find({
          where: { tenantId, variantId: item.variantId },
        });

        for (const recipe of recipes) {
          const deductionQty = Number(item.quantity) * Number(recipe.quantity);

          let stock = await stockRepo.findOne({
            where: {
              tenantId,
              outletId: order.outletId,
              inventoryItemId: recipe.inventoryItemId,
            },
          });

          if (!stock) {
            stock = stockRepo.create({
              tenantId,
              outletId: order.outletId,
              inventoryItemId: recipe.inventoryItemId,
              quantity: -deductionQty,
            });
          } else {
            stock.quantity = Number(stock.quantity) - deductionQty;
          }
          await stockRepo.save(stock);

          const movement = movementRepo.create({
            tenantId,
            outletId: order.outletId,
            inventoryItemId: recipe.inventoryItemId,
            movementType: 'SALE',
            quantity: deductionQty,
            referenceType: 'ORDER',
            referenceId: order.id,
            notes: `Sold via Order ${order.orderNumber} (${item.productName} - ${item.variantName})`,
            movementDate: new Date(),
            createdBy: userId,
          });
          await movementRepo.save(movement);
        }
      }

      await auditRepo.save({
        tenantId,
        actorType: 'USER',
        actorId: userId,
        action: 'PAYMENT_PROCESSED',
        metadata: {
          orderId: order.id,
          paymentId: savedPayment.id,
          transactionId: savedTrx.id,
          transactionNumber: savedTrx.transactionNumber,
          totalAmount: orderTotal,
        },
      });

      return {
        payment: savedPayment,
        transaction: savedTrx,
        order,
      };
    });
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
      qb.andWhere('payment.paidAt >= :startDate', {
        startDate: new Date(query.startDate),
      });
    }

    if (query.endDate) {
      qb.andWhere('payment.paidAt <= :endDate', {
        endDate: new Date(query.endDate),
      });
    }

    qb.orderBy('payment.paidAt', 'DESC');
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
