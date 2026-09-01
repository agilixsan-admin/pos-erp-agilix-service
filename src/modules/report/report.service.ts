import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction } from '../payment/entities/transaction.entity';
import { Payment } from '../payment/entities/payment.entity';
import { Order } from '../order/entities/order.entity';
import { OrderItem } from '../order/entities/order-item.entity';
import { InventoryStock } from '../inventory/entities/inventory-stock.entity';
import { InventoryMovement } from '../inventory/entities/inventory-movement.entity';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import {
  QuerySalesReportDto,
  QuerySummaryReportDto,
  QueryInventoryReportDto,
  QueryInventoryMovementsReportDto,
} from './dto/report.dto';

@Injectable()
export class ReportService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>,
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemRepo: Repository<OrderItem>,
    @InjectRepository(InventoryStock)
    private readonly stockRepo: Repository<InventoryStock>,
    @InjectRepository(InventoryMovement)
    private readonly movementRepo: Repository<InventoryMovement>,
    @InjectRepository(InventoryItem)
    private readonly itemRepo: Repository<InventoryItem>,
  ) {}

  // ─── Summary ──────────────────────────────────────────────────────────────

  async getSummary(tenantId: string, query: QuerySummaryReportDto) {
    const { startDate, endDate, outletId } = query;

    const txQb = this.transactionRepo
      .createQueryBuilder('tx')
      .where('tx.tenant_id = :tenantId', { tenantId })
      .andWhere('tx.completed_at >= :startDate', { startDate })
      .andWhere('tx.completed_at <= :endDate', { endDate });

    if (outletId) {
      txQb.andWhere('tx.outlet_id = :outletId', { outletId });
    }

    const transactions = await txQb.getMany();

    const totalRevenue = transactions.reduce(
      (sum, tx) => sum + Number(tx.amount),
      0,
    );
    const totalTransactions = transactions.length;

    const orderQb = this.orderRepo
      .createQueryBuilder('o')
      .where('o.tenant_id = :tenantId', { tenantId })
      .andWhere('o.status = :status', { status: 'COMPLETED' })
      .andWhere('o.completed_at >= :startDate', { startDate })
      .andWhere('o.completed_at <= :endDate', { endDate });

    if (outletId) {
      orderQb.andWhere('o.outlet_id = :outletId', { outletId });
    }

    const totalOrders = await orderQb.getCount();
    const averageOrderValue =
      totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

    const paymentQb = this.paymentRepo
      .createQueryBuilder('p')
      .select('p.payment_method', 'method')
      .addSelect('SUM(p.amount)', 'total')
      .addSelect('COUNT(p.id)', 'count')
      .where('p.tenant_id = :tenantId', { tenantId })
      .andWhere('p.status = :status', { status: 'SUCCESS' })
      .andWhere('p.paid_at >= :startDate', { startDate })
      .andWhere('p.paid_at <= :endDate', { endDate })
      .groupBy('p.payment_method');

    if (outletId) {
      paymentQb.andWhere('p.outlet_id = :outletId', { outletId });
    }

    const byPaymentMethod = await paymentQb.getRawMany<{
      method: string;
      total: string;
      count: string;
    }>();

    return {
      summary: {
        totalRevenue,
        totalOrders,
        totalTransactions,
        averageOrderValue,
      },
      byPaymentMethod: byPaymentMethod.map((r) => ({
        method: r.method,
        total: Number(r.total),
        count: Number(r.count),
      })),
      meta: { startDate, endDate, outletId: outletId ?? null },
    };
  }

  // ─── Sales ────────────────────────────────────────────────────────────────

  async getSalesReport(tenantId: string, query: QuerySalesReportDto) {
    const { startDate, endDate, outletId } = query;

    // by date
    const byDateQb = this.transactionRepo
      .createQueryBuilder('tx')
      .select("DATE(tx.completed_at AT TIME ZONE 'UTC')", 'date')
      .addSelect('SUM(tx.amount)', 'revenue')
      .addSelect('COUNT(tx.id)', 'transactions')
      .where('tx.tenant_id = :tenantId', { tenantId })
      .andWhere('tx.completed_at >= :startDate', { startDate })
      .andWhere('tx.completed_at <= :endDate', { endDate })
      .groupBy("DATE(tx.completed_at AT TIME ZONE 'UTC')")
      .orderBy("DATE(tx.completed_at AT TIME ZONE 'UTC')", 'ASC');

    if (outletId) {
      byDateQb.andWhere('tx.outlet_id = :outletId', { outletId });
    }

    const byDate = await byDateQb.getRawMany<{
      date: string;
      revenue: string;
      transactions: string;
    }>();

    // orders count per date
    const ordersByDateQb = this.orderRepo
      .createQueryBuilder('o')
      .select("DATE(o.completed_at AT TIME ZONE 'UTC')", 'date')
      .addSelect('COUNT(o.id)', 'orders')
      .where('o.tenant_id = :tenantId', { tenantId })
      .andWhere('o.status = :status', { status: 'COMPLETED' })
      .andWhere('o.completed_at >= :startDate', { startDate })
      .andWhere('o.completed_at <= :endDate', { endDate })
      .groupBy("DATE(o.completed_at AT TIME ZONE 'UTC')");

    if (outletId) {
      ordersByDateQb.andWhere('o.outlet_id = :outletId', { outletId });
    }

    const ordersByDate = await ordersByDateQb.getRawMany<{
      date: string;
      orders: string;
    }>();

    const ordersMap = new Map(
      ordersByDate.map((r) => [r.date, Number(r.orders)]),
    );

    // by product
    const byProductQb = this.orderItemRepo
      .createQueryBuilder('oi')
      .innerJoin('oi.order', 'o')
      .select('oi.product_id', 'productId')
      .addSelect('oi.variant_id', 'variantId')
      .addSelect('oi.product_name', 'productName')
      .addSelect('oi.variant_name', 'variantName')
      .addSelect('SUM(oi.quantity)', 'quantitySold')
      .addSelect('SUM(oi.subtotal)', 'revenue')
      .where('oi.tenant_id = :tenantId', { tenantId })
      .andWhere('o.status = :status', { status: 'COMPLETED' })
      .andWhere('o.completed_at >= :startDate', { startDate })
      .andWhere('o.completed_at <= :endDate', { endDate })
      .groupBy('oi.product_id')
      .addGroupBy('oi.variant_id')
      .addGroupBy('oi.product_name')
      .addGroupBy('oi.variant_name')
      .orderBy('SUM(oi.subtotal)', 'DESC');

    if (outletId) {
      byProductQb.andWhere('o.outlet_id = :outletId', { outletId });
    }

    const byProduct = await byProductQb.getRawMany<{
      productId: string;
      variantId: string;
      productName: string;
      variantName: string;
      quantitySold: string;
      revenue: string;
    }>();

    // by payment method
    const byPaymentQb = this.paymentRepo
      .createQueryBuilder('p')
      .select('p.payment_method', 'method')
      .addSelect('SUM(p.amount)', 'total')
      .addSelect('COUNT(p.id)', 'count')
      .where('p.tenant_id = :tenantId', { tenantId })
      .andWhere('p.status = :status', { status: 'SUCCESS' })
      .andWhere('p.paid_at >= :startDate', { startDate })
      .andWhere('p.paid_at <= :endDate', { endDate })
      .groupBy('p.payment_method');

    if (outletId) {
      byPaymentQb.andWhere('p.outlet_id = :outletId', { outletId });
    }

    const byPaymentMethod = await byPaymentQb.getRawMany<{
      method: string;
      total: string;
      count: string;
    }>();

    const totalRevenue = byDate.reduce((sum, r) => sum + Number(r.revenue), 0);
    const totalTransactions = byDate.reduce(
      (sum, r) => sum + Number(r.transactions),
      0,
    );
    const totalOrders = ordersByDate.reduce(
      (sum, r) => sum + Number(r.orders),
      0,
    );

    return {
      summary: {
        totalRevenue,
        totalOrders,
        totalTransactions,
        averageOrderValue:
          totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0,
      },
      byDate: byDate.map((r) => ({
        date: r.date,
        revenue: Number(r.revenue),
        transactions: Number(r.transactions),
        orders: ordersMap.get(r.date) ?? 0,
      })),
      byProduct: byProduct.map((r) => ({
        productId: r.productId,
        variantId: r.variantId,
        productName: r.productName,
        variantName: r.variantName,
        quantitySold: Number(r.quantitySold),
        revenue: Number(r.revenue),
      })),
      byPaymentMethod: byPaymentMethod.map((r) => ({
        method: r.method,
        total: Number(r.total),
        count: Number(r.count),
      })),
      meta: { startDate, endDate, outletId: outletId ?? null },
    };
  }

  // ─── Inventory ────────────────────────────────────────────────────────────

  async getInventoryReport(tenantId: string, query: QueryInventoryReportDto) {
    const { outletId, search } = query;

    const qb = this.itemRepo
      .createQueryBuilder('item')
      .leftJoinAndSelect('item.stocks', 'stock')
      .leftJoinAndSelect('stock.outlet', 'outlet')
      .where('item.tenant_id = :tenantId', { tenantId })
      .andWhere('item.deleted_at IS NULL')
      .orderBy('item.name', 'ASC');

    if (search) {
      qb.andWhere('item.name ILIKE :search', { search: `%${search}%` });
    }

    if (outletId) {
      qb.andWhere('stock.outlet_id = :outletId', { outletId });
    }

    const items = await qb.getMany();

    const data = items.map((item) => ({
      itemId: item.id,
      itemName: item.name,
      unit: item.unit,
      minimumStock: Number(item.minimumStock),
      outlets: item.stocks.map((s) => ({
        outletId: s.outletId,
        outletName: s.outlet?.name ?? null,
        currentStock: Number(s.quantity),
        isLow: Number(s.quantity) <= Number(item.minimumStock),
      })),
      totalStock: item.stocks.reduce((sum, s) => sum + Number(s.quantity), 0),
    }));

    return {
      data,
      meta: { outletId: outletId ?? null },
    };
  }

  // ─── Inventory Movements ──────────────────────────────────────────────────

  async getInventoryMovementsReport(
    tenantId: string,
    query: QueryInventoryMovementsReportDto,
  ) {
    const {
      outletId,
      itemId,
      movementType,
      startDate,
      endDate,
      page = 1,
      limit = 20,
    } = query;

    const qb = this.movementRepo
      .createQueryBuilder('mv')
      .leftJoinAndSelect('mv.inventoryItem', 'item')
      .leftJoinAndSelect('mv.outlet', 'outlet')
      .leftJoinAndSelect('mv.reasonCategory', 'reason')
      .where('mv.tenant_id = :tenantId', { tenantId })
      .orderBy('mv.movement_date', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (outletId) {
      qb.andWhere('mv.outlet_id = :outletId', { outletId });
    }

    if (itemId) {
      qb.andWhere('mv.inventory_item_id = :itemId', { itemId });
    }

    if (movementType) {
      qb.andWhere('mv.movement_type = :movementType', { movementType });
    }

    if (startDate) {
      qb.andWhere('mv.movement_date >= :startDate', { startDate });
    }

    if (endDate) {
      qb.andWhere('mv.movement_date <= :endDate', { endDate });
    }

    const [movements, total] = await qb.getManyAndCount();

    const data = movements.map((mv) => ({
      id: mv.id,
      date: mv.movementDate,
      itemId: mv.inventoryItemId,
      itemName: mv.inventoryItem?.name ?? null,
      movementType: mv.movementType,
      quantity: Number(mv.quantity),
      unit: mv.inventoryItem?.unit ?? null,
      outletId: mv.outletId,
      outletName: mv.outlet?.name ?? null,
      referenceType: mv.referenceType,
      referenceId: mv.referenceId,
      reason: mv.reasonCategory?.name ?? null,
      notes: mv.notes,
    }));

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
}
