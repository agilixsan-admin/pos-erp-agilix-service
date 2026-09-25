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
import { Recipe } from '../recipe/entities/recipe.entity';
import { PosShift } from '../shift/entities/pos-shift.entity';
import { Expense } from '../finance/entities/expense.entity';
import { FinancialAccount } from '../finance/entities/financial-account.entity';
import { FixedAsset } from '../finance/entities/fixed-asset.entity';
import { CapitalTransaction } from '../finance/entities/capital-transaction.entity';
import { FixedAssetService } from '../finance/services/fixed-asset.service';
import { JournalService } from '../finance/services/journal.service';
import {
  QuerySalesReportDto,
  QuerySummaryReportDto,
  QueryInventoryReportDto,
  QueryInventoryMovementsReportDto,
  QueryShiftReportDto,
  QueryFinancialReportDto,
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
    @InjectRepository(Recipe)
    private readonly recipeRepo: Repository<Recipe>,
    @InjectRepository(PosShift)
    private readonly shiftRepo: Repository<PosShift>,
    @InjectRepository(Expense)
    private readonly expenseRepo: Repository<Expense>,
    @InjectRepository(FinancialAccount)
    private readonly accountRepo: Repository<FinancialAccount>,
    @InjectRepository(FixedAsset)
    private readonly assetRepo: Repository<FixedAsset>,
    @InjectRepository(CapitalTransaction)
    private readonly capitalRepo: Repository<CapitalTransaction>,
    private readonly assetService: FixedAssetService,
    private readonly journalService: JournalService,
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

    // calculate COGS per sold variant from recipes
    const variantIds = byProduct
      .map((r) => r.variantId)
      .filter((id): id is string => Boolean(id));

    let cogsMap = new Map<string, number>();
    if (variantIds.length > 0) {
      const cogsRaw = await this.recipeRepo
        .createQueryBuilder('r')
        .innerJoin('r.inventoryItem', 'ii')
        .select('r.variant_id', 'variantId')
        .addSelect('COALESCE(SUM(r.quantity * ii.unit_cost), 0)', 'unitCogs')
        .where('r.tenant_id = :tenantId', { tenantId })
        .andWhere('r.deleted_at IS NULL')
        .andWhere('ii.deleted_at IS NULL')
        .andWhere('r.variant_id IN (:...variantIds)', { variantIds })
        .groupBy('r.variant_id')
        .getRawMany<{ variantId: string; unitCogs: string }>();

      cogsMap = new Map(
        cogsRaw.map((row) => [row.variantId, Number(row.unitCogs || 0)]),
      );
    }

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

    // Hitung rincian komprehensif dari orders
    const orderTotalsQb = this.orderRepo
      .createQueryBuilder('o')
      .select('COALESCE(SUM(o.subtotal), 0)', 'grossSales')
      .addSelect('COALESCE(SUM(o.discount_amount), 0)', 'totalDiscount')
      .addSelect('COALESCE(SUM(o.tax_amount), 0)', 'totalTax')
      .addSelect('COALESCE(SUM(o.service_charge), 0)', 'totalService')
      .addSelect('COALESCE(SUM(o.packaging_fee), 0)', 'totalPackaging')
      .addSelect('COALESCE(SUM(o.total_amount), 0)', 'totalAmount')
      .where('o.tenant_id = :tenantId', { tenantId })
      .andWhere('o.status = :status', { status: 'COMPLETED' })
      .andWhere('o.completed_at >= :startDate', { startDate })
      .andWhere('o.completed_at <= :endDate', { endDate });

    if (outletId) {
      orderTotalsQb.andWhere('o.outlet_id = :outletId', { outletId });
    }

    const totalsRaw = await orderTotalsQb.getRawOne<{
      grossSales: string;
      totalDiscount: string;
      totalTax: string;
      totalService: string;
      totalPackaging: string;
      totalAmount: string;
    }>();

    const grossSales = totalsRaw?.grossSales
      ? Number(totalsRaw.grossSales)
      : totalRevenue;
    const totalDiscount = Number(totalsRaw?.totalDiscount || 0);
    const netSales = totalsRaw?.grossSales
      ? Math.round((grossSales - totalDiscount) * 100) / 100
      : totalRevenue;
    const totalTax = Number(totalsRaw?.totalTax || 0);
    const totalService = Number(totalsRaw?.totalService || 0);
    const totalPackaging = Number(totalsRaw?.totalPackaging || 0);
    const totalCollected = totalsRaw?.totalAmount
      ? Number(totalsRaw.totalAmount)
      : totalRevenue;

    const totalCogs =
      Math.round(
        byProduct.reduce((sum, p) => {
          const qty = Number(p.quantitySold);
          const unitCogs = cogsMap.get(p.variantId) ?? 0;
          return sum + qty * unitCogs;
        }, 0) * 100,
      ) / 100;

    const grossProfit = Math.round((netSales - totalCogs) * 100) / 100;
    const marginPercentage =
      netSales > 0 ? Math.round((grossProfit / netSales) * 100 * 10) / 10 : 0;

    const effectiveTotalRevenue =
      totalRevenue > 0 ? totalRevenue : totalCollected;

    return {
      summary: {
        grossSales,
        totalDiscount,
        netSales,
        totalCogs,
        grossProfit,
        marginPercentage,
        totalTax,
        totalService,
        totalPackaging,
        totalCollected,
        totalRevenue: effectiveTotalRevenue,
        totalOrders,
        totalTransactions,
        averageOrderValue:
          totalOrders > 0 ? Math.round(effectiveTotalRevenue / totalOrders) : 0,
      },
      byDate: byDate.map((r) => ({
        date: r.date,
        revenue: Number(r.revenue),
        transactions: Number(r.transactions),
        orders: ordersMap.get(r.date) ?? 0,
      })),
      byProduct: byProduct.map((r) => {
        const quantitySold = Number(r.quantitySold);
        const revenue = Number(r.revenue);
        const unitCogs = cogsMap.get(r.variantId) ?? 0;
        const totalCogs = Math.round(quantitySold * unitCogs * 100) / 100;
        const profit = Math.round((revenue - totalCogs) * 100) / 100;
        const marginPercentage =
          revenue > 0
            ? Math.round(((revenue - totalCogs) / revenue) * 100 * 10) / 10
            : 0;

        return {
          productId: r.productId,
          variantId: r.variantId,
          productName: r.productName,
          variantName: r.variantName,
          quantitySold,
          revenue,
          unitCogs,
          totalCogs,
          profit,
          marginPercentage,
        };
      }),
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
      .leftJoinAndSelect('item.category', 'category');

    if (outletId) {
      qb.leftJoinAndSelect(
        'item.stocks',
        'stock',
        'stock.outlet_id = :outletId',
        { outletId },
      );
    } else {
      qb.leftJoinAndSelect('item.stocks', 'stock');
    }

    qb.leftJoinAndSelect('stock.outlet', 'outlet')
      .where('item.tenant_id = :tenantId', { tenantId })
      .andWhere('item.deleted_at IS NULL')
      .orderBy('item.name', 'ASC');

    if (search) {
      qb.andWhere('(item.name ILIKE :search OR item.sku ILIKE :search)', {
        search: `%${search}%`,
      });
    }

    const items = await qb.getMany();

    const mappedItems = items.map((item) => {
      const stocks = item.stocks || [];
      const currentStock = stocks.reduce(
        (sum, s) => sum + Number(s.quantity || 0),
        0,
      );
      const minimumStock = Number(item.minimumStock || 0);
      const unitCost = Number(item.unitCost || 0);
      const valuation = currentStock * unitCost;
      const isLowStock = currentStock <= minimumStock;

      return {
        id: item.id,
        itemId: item.id,
        name: item.name,
        itemName: item.name,
        sku: item.sku ?? null,
        category: item.category?.name ?? 'Umum',
        unit: item.unit,
        unitCost,
        minimumStock,
        currentStock,
        totalStock: currentStock,
        isLowStock,
        valuation,
        outlets: stocks.map((s) => ({
          outletId: s.outletId,
          outletName: s.outlet?.name ?? null,
          currentStock: Number(s.quantity || 0),
          isLow: Number(s.quantity || 0) <= minimumStock,
        })),
      };
    });

    const summary = {
      totalItems: mappedItems.length,
      lowStockItems: mappedItems.filter((i) => i.isLowStock).length,
      totalValuation: mappedItems.reduce((sum, i) => sum + i.valuation, 0),
    };

    return {
      summary,
      items: mappedItems,
      data: mappedItems,
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

  // ─── Laporan Rekonsiliasi Shift ──────────────────────────────────────────

  async getShiftReconciliationReport(
    tenantId: string,
    query: QueryShiftReportDto,
  ) {
    const { startDate, endDate, outletId, userId } = query;
    const qb = this.shiftRepo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.outlet', 'o')
      .leftJoinAndSelect('s.user', 'u')
      .leftJoinAndSelect('s.pettyCashTransactions', 'pct')
      .where('s.tenantId = :tenantId', { tenantId });

    if (outletId && outletId !== 'ALL') {
      qb.andWhere('s.outletId = :outletId', { outletId });
    }
    if (userId) {
      qb.andWhere('s.userId = :userId', { userId });
    }
    if (startDate) {
      qb.andWhere('s.openedAt >= :startDate', { startDate });
    }
    if (endDate) {
      qb.andWhere('s.openedAt <= :endDate', { endDate });
    }

    const shifts = await qb.orderBy('s.openedAt', 'DESC').getMany();

    const data = shifts.map((s) => {
      const diff = Number(s.cashDifference || 0);
      let differenceStatus: 'MATCH' | 'SURPLUS' | 'SHORT' = 'MATCH';
      if (diff > 0) differenceStatus = 'SURPLUS';
      else if (diff < 0) differenceStatus = 'SHORT';

      return {
        id: s.id,
        outletId: s.outletId,
        outletName: s.outlet?.name || 'Outlet',
        userId: s.userId,
        cashierName: s.user?.name || s.user?.email || 'Kasir',
        openedAt: s.openedAt,
        closedAt: s.closedAt,
        status: s.status,
        openingCash: Number(s.openingCash),
        totalCashSales: Number(s.totalCashSales),
        totalCashOut: Number(s.totalCashOut),
        expectedCash: Number(s.expectedCash || 0),
        actualCash: Number(s.actualCash || 0),
        cashDifference: diff,
        differenceStatus,
        notes: s.notes,
        pettyCashCount: s.pettyCashTransactions?.length || 0,
        pettyCashList: (s.pettyCashTransactions || []).map((pct) => ({
          id: pct.id,
          amount: Number(pct.amount),
          category: pct.category,
          notes: pct.notes,
          receiptPhotoUrl: pct.receiptPhotoUrl,
          createdAt: pct.createdAt,
        })),
      };
    });

    return {
      shifts: data,
      summary: {
        totalShifts: data.length,
        totalCashSales: data.reduce((sum, d) => sum + d.totalCashSales, 0),
        totalCashOut: data.reduce((sum, d) => sum + d.totalCashOut, 0),
        totalDifference: data.reduce((sum, d) => sum + d.cashDifference, 0),
        totalShortCount: data.filter((d) => d.differenceStatus === 'SHORT')
          .length,
        totalSurplusCount: data.filter((d) => d.differenceStatus === 'SURPLUS')
          .length,
      },
    };
  }

  // ─── Tiga Laporan Keuangan Standar Akuntansi ─────────────────────────────

  /**
   * 1. Laporan Laba / Rugi Bersih (Income Statement)
   */
  async getIncomeStatement(tenantId: string, query: QueryFinancialReportDto) {
    const { startDate, endDate, outletId } = query;
    const targetOutlet = outletId && outletId !== 'ALL' ? outletId : undefined;

    // A. Penjualan & Diskon & HPP Produk
    const salesReport = await this.getSalesReport(tenantId, {
      startDate,
      endDate,
      outletId: targetOutlet,
    });
    const {
      grossSales,
      totalDiscount,
      netSales,
      totalCogs,
      grossProfit,
      marginPercentage,
    } = salesReport.summary;

    // B. Biaya Operasional (Opex)
    const expenseQb = this.expenseRepo
      .createQueryBuilder('e')
      .innerJoinAndSelect('e.category', 'cat')
      .select('cat.name', 'categoryName')
      .addSelect('SUM(e.amount)', 'total')
      .where('e.tenantId = :tenantId', { tenantId })
      .andWhere('e.expenseDate >= :startDate', {
        startDate: startDate.slice(0, 10),
      })
      .andWhere('e.expenseDate <= :endDate', {
        endDate: endDate.slice(0, 10),
      });

    if (targetOutlet) {
      expenseQb.andWhere('e.outletId = :outletId', { outletId: targetOutlet });
    }

    const expensesByCategory = await expenseQb
      .groupBy('cat.name')
      .getRawMany<{ categoryName: string; total: string }>();

    const totalOpexDirect = expensesByCategory.reduce(
      (sum, c) => sum + Number(c.total || 0),
      0,
    );

    // C. Depresiasi / Penyusutan Aset Tetap
    const assets = await this.assetService.getAssets(
      tenantId,
      targetOutlet,
      endDate,
    );
    const totalDepreciation =
      Math.round(
        assets.reduce((sum, a) => sum + Number(a.monthlyDepreciation || 0), 0) *
          100,
      ) / 100;

    const totalOperatingExpenses =
      Math.round((totalOpexDirect + totalDepreciation) * 100) / 100;
    const netProfit =
      Math.round((grossProfit - totalOperatingExpenses) * 100) / 100;

    return {
      revenue: {
        grossSales,
        discounts: totalDiscount,
        netSales,
      },
      cogs: {
        rawMaterialCogs: totalCogs,
        totalCogs,
      },
      grossProfit,
      marginPercentage,
      operatingExpenses: {
        breakdown: [
          ...expensesByCategory.map((e) => ({
            category: e.categoryName,
            amount: Number(e.total),
          })),
          {
            category: 'Penyusutan Aset Tetap',
            amount: totalDepreciation,
          },
        ],
        totalExpenses: totalOperatingExpenses,
      },
      netProfit,
      meta: { startDate, endDate, outletId: targetOutlet ?? null },
    };
  }

  /**
   * 2. Neraca Keuangan (Balance Sheet)
   */
  async getBalanceSheet(
    tenantId: string,
    asOfDate?: string,
    outletId?: string,
  ) {
    const targetDate = asOfDate || new Date().toISOString().slice(0, 10);
    const targetOutlet = outletId && outletId !== 'ALL' ? outletId : undefined;

    // A. Kas & Bank
    const accounts = await this.accountRepo.find({
      where: { tenantId, isActive: true },
    });
    const filteredAccounts = targetOutlet
      ? accounts.filter((a) => !a.outletId || a.outletId === targetOutlet)
      : accounts;

    const cashInDrawer = filteredAccounts
      .filter((a) => a.accountType === 'CASH')
      .reduce((sum, a) => sum + Number(a.currentBalance || 0), 0);
    const bankAndEwallet = filteredAccounts
      .filter((a) => a.accountType !== 'CASH')
      .reduce((sum, a) => sum + Number(a.currentBalance || 0), 0);

    // B. Persediaan Bahan Baku (Stok Fisik x Harga Modal)
    const stockQb = this.stockRepo
      .createQueryBuilder('s')
      .innerJoin('s.inventoryItem', 'ii')
      .select('SUM(s.quantity * ii.unit_cost)', 'totalValuation')
      .where('s.tenant_id = :tenantId', { tenantId })
      .andWhere('ii.deleted_at IS NULL');

    if (targetOutlet) {
      stockQb.andWhere('s.outlet_id = :outletId', { outletId: targetOutlet });
    }

    const stockValRaw = await stockQb.getRawOne<{ totalValuation: string }>();
    const inventoryValuation = Number(stockValRaw?.totalValuation || 0);

    // C. Nilai Buku Aset Tetap
    const assets = await this.assetService.getAssets(
      tenantId,
      targetOutlet,
      targetDate,
    );
    const totalAssetCost = assets.reduce(
      (sum, a) => sum + Number(a.purchaseCost),
      0,
    );
    const totalAccumulatedDepr = assets.reduce(
      (sum, a) => sum + Number(a.accumulatedDepreciation),
      0,
    );
    const netFixedAssets = totalAssetCost - totalAccumulatedDepr;

    const totalCurrentAssets =
      cashInDrawer + bankAndEwallet + inventoryValuation;
    const totalAssets = totalCurrentAssets + netFixedAssets;

    // D. Kewajiban (Hutang Pajak PB1/PPN & Hutang Usaha / Supplier)
    const taxPayableQb = this.orderRepo
      .createQueryBuilder('o')
      .select('SUM(o.tax_amount)', 'tax')
      .where('o.tenant_id = :tenantId', { tenantId })
      .andWhere('o.status = :status', { status: 'COMPLETED' });

    if (targetOutlet) {
      taxPayableQb.andWhere('o.outlet_id = :outletId', {
        outletId: targetOutlet,
      });
    }

    const taxPayableRaw = await taxPayableQb.getRawOne<{ tax: string }>();
    const taxPayables = Number(taxPayableRaw?.tax || 0);

    const accountsPayable = await this.journalService.getAccountBalance(
      tenantId,
      '2-1100', // Hutang Usaha / Supplier
      targetOutlet,
      targetDate,
    );

    const totalLiabilities =
      Math.round((taxPayables + accountsPayable) * 100) / 100;

    // E. Ekuitas (Total Aset - Total Kewajiban)
    const retainedEarnings =
      Math.round((totalAssets - totalLiabilities) * 100) / 100;

    return {
      asOfDate: targetDate,
      outletId: targetOutlet ?? null,
      assets: {
        currentAssets: {
          cashInDrawer,
          bankAndEwallet,
          inventoryValuation,
          totalCurrentAssets,
        },
        fixedAssets: {
          totalAssetCost,
          totalAccumulatedDepreciation: totalAccumulatedDepr,
          netFixedAssets,
        },
        totalAssets,
      },
      liabilities: {
        taxPayables,
        accountsPayable,
        totalLiabilities,
      },
      equity: {
        retainedEarnings,
        totalEquity: retainedEarnings,
      },
    };
  }

  /**
   * 3. Laporan Arus Kas (Cash Flow Statement)
   */
  async getCashFlowStatement(tenantId: string, query: QueryFinancialReportDto) {
    const { startDate, endDate, outletId } = query;
    const targetOutlet = outletId && outletId !== 'ALL' ? outletId : undefined;

    // Arus Kas Operasional:
    // Penerimaan Kas dari Pembayaran Kasir Lunas
    const paymentQb = this.paymentRepo
      .createQueryBuilder('p')
      .select('SUM(p.amount)', 'total')
      .where('p.tenantId = :tenantId', { tenantId })
      .andWhere('p.status = :status', { status: 'SUCCESS' })
      .andWhere('p.paidAt >= :startDate', { startDate })
      .andWhere('p.paidAt <= :endDate', { endDate });

    if (targetOutlet) {
      paymentQb.andWhere('p.outletId = :outletId', { outletId: targetOutlet });
    }

    const paymentRaw = await paymentQb.getRawOne<{ total: string }>();
    const cashFromSales = Number(paymentRaw?.total || 0);

    // Pengeluaran Kas untuk Biaya Operasional
    const expenseQb = this.expenseRepo
      .createQueryBuilder('e')
      .select('SUM(e.amount)', 'total')
      .where('e.tenantId = :tenantId', { tenantId })
      .andWhere('e.expenseDate >= :startDate', {
        startDate: startDate.slice(0, 10),
      })
      .andWhere('e.expenseDate <= :endDate', {
        endDate: endDate.slice(0, 10),
      });

    if (targetOutlet) {
      expenseQb.andWhere('e.outletId = :outletId', { outletId: targetOutlet });
    }

    const expenseRaw = await expenseQb.getRawOne<{ total: string }>();
    const cashPaidForExpenses = Number(expenseRaw?.total || 0);

    const netOperatingCash = cashFromSales - cashPaidForExpenses;

    // Arus Kas Investasi: Pembelian Aset Tetap
    const assetQb = this.assetRepo
      .createQueryBuilder('a')
      .select('SUM(a.purchaseCost)', 'total')
      .where('a.tenantId = :tenantId', { tenantId })
      .andWhere('a.purchaseDate >= :startDate', {
        startDate: startDate.slice(0, 10),
      })
      .andWhere('a.purchaseDate <= :endDate', {
        endDate: endDate.slice(0, 10),
      });

    if (targetOutlet) {
      assetQb.andWhere('a.outletId = :outletId', { outletId: targetOutlet });
    }

    const assetRaw = await assetQb.getRawOne<{ total: string }>();
    const cashPaidForAssets = Number(assetRaw?.total || 0);
    const netInvestingCash = -cashPaidForAssets;

    // Arus Kas Pendanaan:
    const capitalQb = this.capitalRepo
      .createQueryBuilder('ct')
      .select('ct.type', 'type')
      .addSelect('SUM(ct.amount)', 'total')
      .where('ct.tenantId = :tenantId', { tenantId })
      .andWhere('ct.transactionDate >= :startDate', {
        startDate: startDate.slice(0, 10),
      })
      .andWhere('ct.transactionDate <= :endDate', {
        endDate: endDate.slice(0, 10),
      })
      .groupBy('ct.type');

    if (targetOutlet) {
      capitalQb.andWhere('(ct.outletId = :outletId OR ct.outletId IS NULL)', {
        outletId: targetOutlet,
      });
    }

    const capitalRaw = await capitalQb.getRawMany<{
      type: string;
      total: string;
    }>();
    let cashFromCapitalInjections = 0;
    let cashFromLoans = 0;
    let cashPaidForDrawings = 0;
    let cashPaidForLoanRepayments = 0;

    for (const row of capitalRaw) {
      const val = Number(row.total || 0);
      if (row.type === 'CAPITAL_INJECTION') cashFromCapitalInjections += val;
      if (row.type === 'LOAN_RECEIPT') cashFromLoans += val;
      if (row.type === 'OWNER_WITHDRAWAL') cashPaidForDrawings += val;
      if (row.type === 'LOAN_REPAYMENT') cashPaidForLoanRepayments += val;
    }

    const netFinancingCash =
      cashFromCapitalInjections +
      cashFromLoans -
      (cashPaidForDrawings + cashPaidForLoanRepayments);

    const netCashChange =
      netOperatingCash + netInvestingCash + netFinancingCash;

    return {
      operatingActivities: {
        cashFromSales,
        cashPaidForExpenses,
        netOperatingCash,
      },
      investingActivities: {
        cashPaidForAssets,
        netInvestingCash,
      },
      financingActivities: {
        cashFromCapitalInjections,
        cashFromLoans,
        cashPaidForDrawings,
        cashPaidForLoanRepayments,
        netFinancingCash,
      },
      netCashChange,
      meta: { startDate, endDate, outletId: targetOutlet ?? null },
    };
  }
}
