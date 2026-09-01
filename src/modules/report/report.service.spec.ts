import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ReportService } from './report.service';
import { Transaction } from '../payment/entities/transaction.entity';
import { Payment } from '../payment/entities/payment.entity';
import { Order } from '../order/entities/order.entity';
import { OrderItem } from '../order/entities/order-item.entity';
import { InventoryStock } from '../inventory/entities/inventory-stock.entity';
import { InventoryMovement } from '../inventory/entities/inventory-movement.entity';
import { InventoryItem } from '../inventory/entities/inventory-item.entity';

describe('ReportService', () => {
  let service: ReportService;

  const mockTransactionRepo = { createQueryBuilder: jest.fn() };
  const mockPaymentRepo = { createQueryBuilder: jest.fn() };
  const mockOrderRepo = { createQueryBuilder: jest.fn() };
  const mockOrderItemRepo = { createQueryBuilder: jest.fn() };
  const mockStockRepo = { createQueryBuilder: jest.fn() };
  const mockMovementRepo = { createQueryBuilder: jest.fn() };
  const mockItemRepo = { createQueryBuilder: jest.fn() };

  const buildQb = (overrides: Record<string, jest.Mock> = {}) => ({
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    addGroupBy: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([]),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    getCount: jest.fn().mockResolvedValue(0),
    getRawMany: jest.fn().mockResolvedValue([]),
    ...overrides,
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportService,
        {
          provide: getRepositoryToken(Transaction),
          useValue: mockTransactionRepo,
        },
        { provide: getRepositoryToken(Payment), useValue: mockPaymentRepo },
        { provide: getRepositoryToken(Order), useValue: mockOrderRepo },
        { provide: getRepositoryToken(OrderItem), useValue: mockOrderItemRepo },
        {
          provide: getRepositoryToken(InventoryStock),
          useValue: mockStockRepo,
        },
        {
          provide: getRepositoryToken(InventoryMovement),
          useValue: mockMovementRepo,
        },
        { provide: getRepositoryToken(InventoryItem), useValue: mockItemRepo },
      ],
    }).compile();

    service = module.get<ReportService>(ReportService);
  });

  // ─── getSummary ───────────────────────────────────────────────────────────

  describe('getSummary', () => {
    it('returns aggregated summary for a date range scoped to tenant', async () => {
      const txQb = buildQb({
        getMany: jest
          .fn()
          .mockResolvedValue([{ amount: '50000' }, { amount: '30000' }]),
      });
      const orderQb = buildQb({ getCount: jest.fn().mockResolvedValue(2) });
      const paymentQb = buildQb({
        getRawMany: jest
          .fn()
          .mockResolvedValue([{ method: 'CASH', total: '80000', count: '2' }]),
      });

      mockTransactionRepo.createQueryBuilder.mockReturnValue(txQb);
      mockOrderRepo.createQueryBuilder.mockReturnValue(orderQb);
      mockPaymentRepo.createQueryBuilder.mockReturnValue(paymentQb);

      const result = await service.getSummary('tenant-1', {
        startDate: '2026-09-01T00:00:00Z',
        endDate: '2026-09-01T23:59:59Z',
      });

      expect(result.summary.totalRevenue).toBe(80000);
      expect(result.summary.totalTransactions).toBe(2);
      expect(result.summary.totalOrders).toBe(2);
      expect(result.summary.averageOrderValue).toBe(40000);
      expect(result.byPaymentMethod).toHaveLength(1);
      expect(result.byPaymentMethod[0].method).toBe('CASH');
      expect(result.meta.outletId).toBeNull();
    });

    it('applies outletId filter when provided', async () => {
      const txQb = buildQb({ getMany: jest.fn().mockResolvedValue([]) });
      const orderQb = buildQb({ getCount: jest.fn().mockResolvedValue(0) });
      const paymentQb = buildQb({
        getRawMany: jest.fn().mockResolvedValue([]),
      });

      mockTransactionRepo.createQueryBuilder.mockReturnValue(txQb);
      mockOrderRepo.createQueryBuilder.mockReturnValue(orderQb);
      mockPaymentRepo.createQueryBuilder.mockReturnValue(paymentQb);

      await service.getSummary('tenant-1', {
        startDate: '2026-09-01T00:00:00Z',
        endDate: '2026-09-01T23:59:59Z',
        outletId: 'outlet-1',
      });

      expect(txQb.andWhere).toHaveBeenCalledWith('tx.outlet_id = :outletId', {
        outletId: 'outlet-1',
      });
    });

    it('returns averageOrderValue of 0 when there are no orders', async () => {
      const txQb = buildQb({ getMany: jest.fn().mockResolvedValue([]) });
      const orderQb = buildQb({ getCount: jest.fn().mockResolvedValue(0) });
      const paymentQb = buildQb({
        getRawMany: jest.fn().mockResolvedValue([]),
      });

      mockTransactionRepo.createQueryBuilder.mockReturnValue(txQb);
      mockOrderRepo.createQueryBuilder.mockReturnValue(orderQb);
      mockPaymentRepo.createQueryBuilder.mockReturnValue(paymentQb);

      const result = await service.getSummary('tenant-1', {
        startDate: '2026-09-01T00:00:00Z',
        endDate: '2026-09-01T23:59:59Z',
      });

      expect(result.summary.averageOrderValue).toBe(0);
    });
  });

  // ─── getSalesReport ───────────────────────────────────────────────────────

  describe('getSalesReport', () => {
    it('returns sales breakdown by date, product, and payment method', async () => {
      const txQb = buildQb({
        getRawMany: jest
          .fn()
          .mockResolvedValue([
            { date: '2026-09-01', revenue: '80000', transactions: '2' },
          ]),
      });
      const orderQb = buildQb({
        getRawMany: jest
          .fn()
          .mockResolvedValue([{ date: '2026-09-01', orders: '2' }]),
      });
      const itemQb = buildQb({
        getRawMany: jest.fn().mockResolvedValue([
          {
            productId: 'prod-1',
            variantId: 'var-1',
            productName: 'Americano',
            variantName: 'Regular',
            quantitySold: '4',
            revenue: '80000',
          },
        ]),
      });
      const paymentQb = buildQb({
        getRawMany: jest
          .fn()
          .mockResolvedValue([{ method: 'CASH', total: '80000', count: '2' }]),
      });

      mockTransactionRepo.createQueryBuilder.mockReturnValue(txQb);
      mockOrderRepo.createQueryBuilder.mockReturnValue(orderQb);
      mockOrderItemRepo.createQueryBuilder.mockReturnValue(itemQb);
      mockPaymentRepo.createQueryBuilder.mockReturnValue(paymentQb);

      const result = await service.getSalesReport('tenant-1', {
        startDate: '2026-09-01T00:00:00Z',
        endDate: '2026-09-01T23:59:59Z',
      });

      expect(result.summary.totalRevenue).toBe(80000);
      expect(result.byDate).toHaveLength(1);
      expect(result.byDate[0].orders).toBe(2);
      expect(result.byProduct).toHaveLength(1);
      expect(result.byProduct[0].productName).toBe('Americano');
      expect(result.byPaymentMethod[0].method).toBe('CASH');
    });

    it('scopes query to tenantId', async () => {
      const txQb = buildQb({ getRawMany: jest.fn().mockResolvedValue([]) });
      const orderQb = buildQb({ getRawMany: jest.fn().mockResolvedValue([]) });
      const itemQb = buildQb({ getRawMany: jest.fn().mockResolvedValue([]) });
      const paymentQb = buildQb({
        getRawMany: jest.fn().mockResolvedValue([]),
      });

      mockTransactionRepo.createQueryBuilder.mockReturnValue(txQb);
      mockOrderRepo.createQueryBuilder.mockReturnValue(orderQb);
      mockOrderItemRepo.createQueryBuilder.mockReturnValue(itemQb);
      mockPaymentRepo.createQueryBuilder.mockReturnValue(paymentQb);

      await service.getSalesReport('tenant-1', {
        startDate: '2026-09-01T00:00:00Z',
        endDate: '2026-09-01T23:59:59Z',
      });

      expect(txQb.where).toHaveBeenCalledWith('tx.tenant_id = :tenantId', {
        tenantId: 'tenant-1',
      });
    });
  });

  // ─── getInventoryReport ───────────────────────────────────────────────────

  describe('getInventoryReport', () => {
    it('returns stock per item with low stock flag', async () => {
      const qb = buildQb({
        getMany: jest.fn().mockResolvedValue([
          {
            id: 'item-1',
            name: 'Coffee Beans',
            unit: 'gram',
            minimumStock: '500',
            stocks: [
              {
                outletId: 'outlet-1',
                outlet: { name: 'Outlet A' },
                quantity: '300',
              },
            ],
          },
        ]),
      });
      mockItemRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getInventoryReport('tenant-1', {});

      expect(result.data).toHaveLength(1);
      expect(result.data[0].itemName).toBe('Coffee Beans');
      expect(result.data[0].outlets[0].currentStock).toBe(300);
      expect(result.data[0].outlets[0].isLow).toBe(true);
    });

    it('applies search filter when provided', async () => {
      const qb = buildQb({ getMany: jest.fn().mockResolvedValue([]) });
      mockItemRepo.createQueryBuilder.mockReturnValue(qb);

      await service.getInventoryReport('tenant-1', { search: 'coffee' });

      expect(qb.andWhere).toHaveBeenCalledWith('item.name ILIKE :search', {
        search: '%coffee%',
      });
    });

    it('applies outletId filter when provided', async () => {
      const qb = buildQb({ getMany: jest.fn().mockResolvedValue([]) });
      mockItemRepo.createQueryBuilder.mockReturnValue(qb);

      await service.getInventoryReport('tenant-1', { outletId: 'outlet-1' });

      expect(qb.andWhere).toHaveBeenCalledWith('stock.outlet_id = :outletId', {
        outletId: 'outlet-1',
      });
    });

    it('marks item as not low when stock exceeds minimumStock', async () => {
      const qb = buildQb({
        getMany: jest.fn().mockResolvedValue([
          {
            id: 'item-1',
            name: 'Milk',
            unit: 'ml',
            minimumStock: '100',
            stocks: [
              {
                outletId: 'outlet-1',
                outlet: { name: 'Outlet A' },
                quantity: '1000',
              },
            ],
          },
        ]),
      });
      mockItemRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getInventoryReport('tenant-1', {});

      expect(result.data[0].outlets[0].isLow).toBe(false);
    });
  });

  // ─── getInventoryMovementsReport ──────────────────────────────────────────

  describe('getInventoryMovementsReport', () => {
    it('returns paginated movements scoped to tenant', async () => {
      const qb = buildQb({
        getManyAndCount: jest.fn().mockResolvedValue([
          [
            {
              id: 'mov-1',
              movementDate: new Date('2026-09-01T10:00:00Z'),
              inventoryItemId: 'item-1',
              inventoryItem: { name: 'Coffee Beans', unit: 'gram' },
              movementType: 'SALE',
              quantity: '-36',
              outletId: 'outlet-1',
              outlet: { name: 'Outlet A' },
              referenceType: 'ORDER',
              referenceId: 'ord-1',
              reasonCategory: null,
              notes: null,
            },
          ],
          1,
        ]),
      });
      mockMovementRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getInventoryMovementsReport('tenant-1', {
        page: 1,
        limit: 20,
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].movementType).toBe('SALE');
      expect(result.data[0].quantity).toBe(-36);
      expect(result.meta.total).toBe(1);
      expect(result.meta.totalPages).toBe(1);
    });

    it('applies movementType filter when provided', async () => {
      const qb = buildQb({
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      });
      mockMovementRepo.createQueryBuilder.mockReturnValue(qb);

      await service.getInventoryMovementsReport('tenant-1', {
        movementType: 'ADJUSTMENT',
      });

      expect(qb.andWhere).toHaveBeenCalledWith(
        'mv.movement_type = :movementType',
        { movementType: 'ADJUSTMENT' },
      );
    });

    it('applies date range filters when provided', async () => {
      const qb = buildQb({
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      });
      mockMovementRepo.createQueryBuilder.mockReturnValue(qb);

      await service.getInventoryMovementsReport('tenant-1', {
        startDate: '2026-09-01T00:00:00Z',
        endDate: '2026-09-30T23:59:59Z',
      });

      expect(qb.andWhere).toHaveBeenCalledWith(
        'mv.movement_date >= :startDate',
        { startDate: '2026-09-01T00:00:00Z' },
      );
      expect(qb.andWhere).toHaveBeenCalledWith('mv.movement_date <= :endDate', {
        endDate: '2026-09-30T23:59:59Z',
      });
    });

    it('calculates totalPages correctly', async () => {
      const qb = buildQb({
        getManyAndCount: jest.fn().mockResolvedValue([[], 45]),
      });
      mockMovementRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getInventoryMovementsReport('tenant-1', {
        page: 1,
        limit: 20,
      });

      expect(result.meta.totalPages).toBe(3);
      expect(result.meta.total).toBe(45);
    });
  });
});
