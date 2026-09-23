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
import { Table } from '../../table/entities/table.entity';
import { AuditService } from '../../audit/audit.service';
import { OrderItem } from '../../order/entities/order-item.entity';
import { Recipe } from '../../recipe/entities/recipe.entity';
import { FinancialAccount } from '../../finance/entities/financial-account.entity';
import { FinanceAccountService } from '../../finance/services/finance-account.service';
import { JournalService } from '../../finance/services/journal.service';
import { retryOnUniqueViolation } from '../../../common/utils/retry-on-unique-violation.util';
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
    private readonly financeAccountService: FinanceAccountService,
    private readonly journalService: JournalService,
  ) {}

  private generateTransactionNumber(): string {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(100000 + Math.random() * 900000);
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
    if (typeof orderRepo.update === 'function') {
      await orderRepo.update(
        { id: order.id, tenantId: order.tenantId },
        {
          status: 'COMPLETED',
          completedAt: order.completedAt,
        },
      );
    } else {
      await orderRepo.save(order);
    }

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

    await this.audit.record(
      {
        action: 'PAYMENT_PROCESSED',
        tenantId: order.tenantId,
        actorType: userId ? 'USER' : 'SYSTEM',
        actorId: userId ?? null,
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

    // ─── Auto-Journaling & Financial Account Balance Update ─────────────────
    try {
      const isCash = payment.paymentMethod === 'CASH';
      let targetAccountCode = '1-1250';

      if (isCash) {
        targetAccountCode = '1-1100';
        const cashAccount =
          await this.financeAccountService.ensureOutletCashAccount(
            order.tenantId,
            order.outletId,
            manager,
          );
        cashAccount.currentBalance =
          Number(cashAccount.currentBalance) + orderTotal;
        await manager.save(cashAccount);
      } else {
        const faRepo = manager.getRepository(FinancialAccount);
        let qrisAccount = await faRepo.findOne({
          where: {
            tenantId: order.tenantId,
            accountType: 'PAYMENT_GATEWAY',
            isActive: true,
          },
        });
        if (!qrisAccount) {
          qrisAccount = faRepo.create({
            tenantId: order.tenantId,
            accountCode: '1-1250',
            accountName: 'Saldo QRIS & Payment Gateway',
            accountType: 'PAYMENT_GATEWAY',
            currentBalance: 0,
            isActive: true,
          });
        }
        qrisAccount.currentBalance =
          Number(qrisAccount.currentBalance) + orderTotal;
        await manager.save(qrisAccount);
      }

      // Auto-Journal Penjualan Produk
      const journalLines: {
        accountCode: string;
        debit: number;
        credit: number;
        notes?: string;
      }[] = [
        {
          accountCode: targetAccountCode,
          debit: orderTotal,
          credit: 0,
          notes: `Penerimaan ${payment.paymentMethod} Pesanan ${order.orderNumber}`,
        },
      ];

      const discountAmt = Number(order.discountAmount || 0);
      if (discountAmt > 0) {
        journalLines.push({
          accountCode: '4-2000',
          debit: discountAmt,
          credit: 0,
          notes: `Diskon Pesanan ${order.orderNumber}`,
        });
      }

      const subtotalAmt = Number(order.subtotal || 0);
      journalLines.push({
        accountCode: '4-1000',
        debit: 0,
        credit: subtotalAmt,
        notes: `Gross Sales Pesanan ${order.orderNumber}`,
      });

      const taxAmt = Number(order.taxAmount || 0);
      if (taxAmt > 0) {
        journalLines.push({
          accountCode: '2-1200',
          debit: 0,
          credit: taxAmt,
          notes: `Hutang Pajak Pesanan ${order.orderNumber}`,
        });
      }

      const serviceAmt = Number(order.serviceCharge || 0);
      if (serviceAmt > 0) {
        journalLines.push({
          accountCode: '2-1300',
          debit: 0,
          credit: serviceAmt,
          notes: `Service Charge Pesanan ${order.orderNumber}`,
        });
      }

      const packagingAmt = Number(order.packagingFee || 0);
      if (packagingAmt > 0) {
        journalLines.push({
          accountCode: '4-3000',
          debit: 0,
          credit: packagingAmt,
          notes: `Biaya Kemasan Pesanan ${order.orderNumber}`,
        });
      }

      await this.journalService.recordJournal(
        {
          tenantId: order.tenantId,
          outletId: order.outletId,
          entryDate: new Date().toISOString().slice(0, 10),
          sourceType: 'ORDER_SALE',
          sourceId: order.id,
          description: `Penjualan Pesanan #${order.orderNumber} (${payment.paymentMethod})`,
          createdBy: userId ?? null,
          lines: journalLines,
        },
        manager,
      );

      // Auto-Journal HPP Resep Bahan Baku
      const orderItemRepo = manager.getRepository(OrderItem);
      const items = await orderItemRepo.find({
        where: { orderId: order.id, tenantId: order.tenantId },
      });

      let totalOrderCogs = 0;
      const recipeRepo = manager.getRepository(Recipe);
      for (const item of items) {
        const recipes = await recipeRepo.find({
          where: { tenantId: order.tenantId, variantId: item.variantId },
          relations: ['inventoryItem'],
        });
        for (const r of recipes) {
          const unitCost = Number(r.inventoryItem?.unitCost || 0);
          totalOrderCogs +=
            Number(item.quantity) * Number(r.quantity) * unitCost;
        }
      }

      if (totalOrderCogs > 0) {
        const cogsRounded = Math.round(totalOrderCogs * 100) / 100;
        await this.journalService.recordJournal(
          {
            tenantId: order.tenantId,
            outletId: order.outletId,
            entryDate: new Date().toISOString().slice(0, 10),
            sourceType: 'ORDER_COGS',
            sourceId: order.id,
            description: `HPP Bahan Baku Pesanan #${order.orderNumber}`,
            createdBy: userId ?? null,
            lines: [
              {
                accountCode: '5-1000',
                debit: cogsRounded,
                credit: 0,
                notes: `HPP Resep Pesanan ${order.orderNumber}`,
              },
              {
                accountCode: '1-1300',
                debit: 0,
                credit: cogsRounded,
                notes: `Pengurangan Persediaan Bahan Baku Pesanan ${order.orderNumber}`,
              },
            ],
          },
          manager,
        );
      }
    } catch {
      // Tangani auto-journal secara aman agar transaksi pembayaran tidak terganggu
    }

    (order as unknown as Record<string, unknown>).paidAmount = Number(
      payment.amount,
    );
    (order as unknown as Record<string, unknown>).changeAmount = Number(
      payment.changeAmount,
    );
    (order as unknown as Record<string, unknown>).paymentMethod =
      payment.paymentMethod;
    (order as unknown as Record<string, unknown>).transaction = savedTrx;

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
    const paidAmount =
      dto.paymentMethod === 'CASH' && dto.cashGiven !== undefined
        ? Number(dto.cashGiven)
        : Number(dto.amount);

    if (paidAmount < orderTotal) {
      throw new BadRequestException({
        success: false,
        message: `Payment amount (${paidAmount}) is less than order total (${orderTotal})`,
        code: 'INSUFFICIENT_PAYMENT',
      });
    }

    const changeAmount =
      dto.paymentMethod === 'CASH' ? paidAmount - orderTotal : 0;

    return retryOnUniqueViolation(() =>
      this.dataSource.transaction(async (manager) => {
        const paymentRepo = manager.getRepository(Payment);

        const payment = paymentRepo.create({
          tenantId,
          outletId: order.outletId,
          orderId: order.id,
          paymentMethod: dto.paymentMethod,
          amount: paidAmount,
          changeAmount,
          status: 'SUCCESS',
          referenceNumber: dto.referenceNumber ?? null,
          paidAt: new Date(),
          createdBy: userId,
        });
        const savedPayment = await paymentRepo.save(payment);

        return this.executeSettlement(manager, savedPayment, order, userId);
      }),
    );
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
    return retryOnUniqueViolation(() =>
      this.dataSource.transaction(async (manager) => {
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
      }),
    );
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
