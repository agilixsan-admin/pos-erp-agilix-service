import { BadRequestException } from '@nestjs/common';
import { OrderService } from '../modules/order/services/order.service';
import { PaymentService } from '../modules/payment/services/payment.service';
import { Order } from '../modules/order/entities/order.entity';
import { OrderItem } from '../modules/order/entities/order-item.entity';
import { Void } from '../modules/order/entities/void.entity';
import { Table } from '../modules/table/entities/table.entity';
import { Recipe } from '../modules/recipe/entities/recipe.entity';
import { InventoryStock } from '../modules/inventory/entities/inventory-stock.entity';
import { InventoryMovement } from '../modules/inventory/entities/inventory-movement.entity';
import { Packaging } from '../modules/packaging/entities/packaging.entity';
import { Payment } from '../modules/payment/entities/payment.entity';
import { Transaction } from '../modules/payment/entities/transaction.entity';

describe('Business Flow & Transaction Hardening Tests (Phase 18)', () => {
  const tenantId = 'tenant-test-123';
  const outletId = 'outlet-test-123';
  const userId = 'user-test-123';

  describe('1. Order Lifecycle & Table Reservation Hardening', () => {
    let orderService: OrderService;
    const mockOrderRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
    };
    const mockOrderItemRepo = { create: jest.fn(), save: jest.fn() };
    const mockVoidRepo = { create: jest.fn(), save: jest.fn() };
    const mockOutletRepo = { findOne: jest.fn() };
    const mockVariantRepo = { find: jest.fn() };
    const mockTableRepo = { findOne: jest.fn(), save: jest.fn() };
    const mockDataSource = { transaction: jest.fn() };
    const mockAuditService = { record: jest.fn().mockResolvedValue(undefined) };
    const mockSettingsService = {
      getSettings: jest.fn().mockResolvedValue({ taxEnabled: false }),
    };
    const mockPackagingService = {
      findApplicableForOrder: jest.fn().mockResolvedValue([]),
    };

    beforeEach(() => {
      jest.clearAllMocks();
      orderService = new OrderService(
        mockOrderRepo as any,
        mockOrderItemRepo as any,
        mockVoidRepo as any,
        mockOutletRepo as any,
        mockVariantRepo as any,
        mockTableRepo as any,
        mockDataSource as any,
        mockAuditService as any,
        mockSettingsService as any,
        {} as any,
        mockPackagingService as any,
      );
    });

    it('rejects Dine-In order when chosen table is already OCCUPIED', async () => {
      mockOutletRepo.findOne.mockResolvedValue({ id: outletId, tenantId });
      mockVariantRepo.find.mockResolvedValue([
        {
          id: 'v1',
          tenantId,
          productId: 'p1',
          price: 25000,
          status: 'ACTIVE',
          name: 'Regular',
          product: { id: 'p1', name: 'Latte' },
        },
      ]);
      mockTableRepo.findOne.mockResolvedValue({
        id: 'table-1',
        tenantId,
        outletId,
        status: 'OCCUPIED', // Already occupied!
      });

      await expect(
        orderService.create(tenantId, userId, outletId, {
          outletId,
          orderType: 'DINE_IN',
          tableId: 'table-1',
          items: [{ variantId: 'v1', quantity: 1 }],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('marks AVAILABLE table as OCCUPIED during Dine-In order creation', async () => {
      mockOutletRepo.findOne.mockResolvedValue({ id: outletId, tenantId });
      mockVariantRepo.find.mockResolvedValue([
        {
          id: 'v1',
          tenantId,
          productId: 'p1',
          price: 25000,
          status: 'ACTIVE',
          name: 'Regular',
          product: { id: 'p1', name: 'Latte' },
        },
      ]);
      const availableTable: Partial<Table> = {
        id: 'table-1',
        tenantId,
        outletId,
        status: 'AVAILABLE',
      };
      mockTableRepo.findOne.mockResolvedValue(availableTable);

      const fakeOrderRepo = {
        create: jest.fn((data) => ({ id: 'order-1', ...data })),
        save: jest.fn((data) => Promise.resolve({ id: 'order-1', ...data })),
        findOne: jest
          .fn()
          .mockResolvedValue({ id: 'order-1', status: 'PENDING' }),
      };
      const fakeItemRepo = {
        create: jest.fn((data) => data),
        save: jest.fn((data) => Promise.resolve(data)),
      };
      const fakeTableRepo = {
        save: jest.fn((t) => Promise.resolve(t)),
      };

      mockDataSource.transaction.mockImplementation(async (cb: any) => {
        const fakeManager = {
          getRepository: jest.fn((entity) => {
            if (entity === Order) return fakeOrderRepo;
            if (entity === OrderItem) return fakeItemRepo;
            if (entity === Table) return fakeTableRepo;
            return {
              create: jest.fn((d) => d),
              save: jest.fn((d) => Promise.resolve(d)),
              findOne: jest.fn(),
            };
          }),
        };
        return cb(fakeManager);
      });

      const order = await orderService.create(tenantId, userId, outletId, {
        outletId,
        orderType: 'DINE_IN',
        tableId: 'table-1',
        items: [{ variantId: 'v1', quantity: 1 }],
      });

      expect(order).toBeDefined();
      expect(availableTable.status).toBe('OCCUPIED');
      expect(fakeTableRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'OCCUPIED' }),
      );
    });
  });

  describe('2. Void Order Flow Hardening', () => {
    let orderService: OrderService;
    const mockQueryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn(),
    };
    const mockOrderRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
    };
    const mockVoidRepo = { create: jest.fn(), save: jest.fn() };
    const mockTableRepo = { findOne: jest.fn(), save: jest.fn() };
    const mockDataSource = { transaction: jest.fn() };
    const mockAuditService = { record: jest.fn().mockResolvedValue(undefined) };

    beforeEach(() => {
      jest.clearAllMocks();
      orderService = new OrderService(
        mockOrderRepo as any,
        {} as any,
        mockVoidRepo as any,
        {} as any,
        {} as any,
        mockTableRepo as any,
        mockDataSource as any,
        mockAuditService as any,
        {} as any,
        {} as any,
        {} as any,
      );
    });

    it('allows voiding a SENT order and releases table if Dine-In', async () => {
      const occupiedTable: Partial<Table> = {
        id: 'table-1',
        status: 'OCCUPIED',
      };
      const sentOrder: Partial<Order> = {
        id: 'order-1',
        tenantId,
        status: 'SENT',
        orderType: 'DINE_IN',
        tableId: 'table-1',
        table: occupiedTable as Table,
      };

      mockQueryBuilder.getOne.mockResolvedValue(sentOrder);
      mockTableRepo.findOne.mockResolvedValue(occupiedTable);

      const fakeVoidRepo = {
        create: jest.fn((data) => data),
        save: jest.fn((data) => Promise.resolve({ id: 'void-1', ...data })),
      };
      const fakeOrderRepo = {
        save: jest.fn((data) => Promise.resolve(data)),
      };
      const fakeTableRepo = {
        findOne: jest.fn().mockResolvedValue(occupiedTable),
        save: jest.fn((data) => Promise.resolve(data)),
      };

      mockDataSource.transaction.mockImplementation(async (cb: any) => {
        const fakeManager = {
          getRepository: jest.fn((entity) => {
            if (entity === Void) return fakeVoidRepo;
            if (entity === Order) return fakeOrderRepo;
            if (entity === Table) return fakeTableRepo;
            return {
              create: jest.fn((d) => d),
              save: jest.fn((d) => Promise.resolve(d)),
            };
          }),
        };
        return cb(fakeManager);
      });

      const result = await orderService.void(
        tenantId,
        userId,
        outletId,
        'order-1',
        {
          reason: 'Customer changed mind',
        },
      );

      expect(result).toBeDefined();
      expect(mockDataSource.transaction).toHaveBeenCalled();
      expect(occupiedTable.status).toBe('AVAILABLE');
      expect(fakeTableRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'table-1', status: 'AVAILABLE' }),
      );
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'ORDER_VOIDED',
          tenantId,
        }),
        expect.anything(),
      );
    });

    it('rejects voiding an already COMPLETED order', async () => {
      const completedOrder: Partial<Order> = {
        id: 'order-1',
        tenantId,
        status: 'COMPLETED',
      };

      mockQueryBuilder.getOne.mockResolvedValue(completedOrder);

      await expect(
        orderService.void(tenantId, userId, outletId, 'order-1', {
          reason: 'Customer returned',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects voiding an already VOID order', async () => {
      const voidOrder: Partial<Order> = {
        id: 'order-1',
        tenantId,
        status: 'VOID',
      };

      mockQueryBuilder.getOne.mockResolvedValue(voidOrder);

      await expect(
        orderService.void(tenantId, userId, outletId, 'order-1', {
          reason: 'Double void attempt',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('3. Payment & Settlement Integrity Hardening', () => {
    let paymentService: PaymentService;
    const mockPaymentRepo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    const mockTrxRepo = { create: jest.fn(), save: jest.fn() };
    const mockOrderRepo = { findOne: jest.fn() };
    const mockDataSource = { transaction: jest.fn() };
    const mockAuditService = { record: jest.fn().mockResolvedValue(undefined) };
    const mockSettingsService = {
      getSettings: jest
        .fn()
        .mockResolvedValue({ cashEnabled: true, qrisEnabled: true }),
    };

    beforeEach(() => {
      jest.clearAllMocks();
      paymentService = new PaymentService(
        mockPaymentRepo as any,
        mockTrxRepo as any,
        mockOrderRepo as any,
        {} as any,
        mockDataSource as any,
        mockAuditService as any,
        mockSettingsService as any,
      );
    });

    it('rejects cash payment when amount is less than totalAmount', async () => {
      const pendingOrder: Partial<Order> = {
        id: 'order-1',
        tenantId,
        outletId,
        orderNumber: 'ORD-001',
        status: 'SENT',
        totalAmount: 50000,
        items: [],
      };

      mockOrderRepo.findOne.mockResolvedValue(pendingOrder);

      await expect(
        paymentService.create(tenantId, userId, {
          orderId: 'order-1',
          paymentMethod: 'CASH',
          amount: 40000, // LESS than 50000!
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects payment attempt on an already COMPLETED order (Double Payment Prevention)', async () => {
      const completedOrder: Partial<Order> = {
        id: 'order-1',
        tenantId,
        outletId,
        status: 'COMPLETED', // Already completed!
        totalAmount: 50000,
      };

      mockOrderRepo.findOne.mockResolvedValue(completedOrder);

      await expect(
        paymentService.create(tenantId, userId, {
          orderId: 'order-1',
          paymentMethod: 'CASH',
          amount: 50000,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('computes exact change amount on valid cash payment and completes order atomically', async () => {
      const availableTable: Partial<Table> = {
        id: 'table-1',
        status: 'OCCUPIED',
      };
      const pendingOrder: Partial<Order> = {
        id: 'order-1',
        tenantId,
        outletId,
        orderNumber: 'ORD-001',
        orderType: 'DINE_IN',
        tableId: 'table-1',
        table: availableTable as Table,
        status: 'SENT',
        subtotal: 50000,
        totalAmount: 55000, // 50k + tax
        discountAmount: 0,
        taxAmount: 5000,
        packagingFee: 0,
        items: [],
      };

      mockOrderRepo.findOne.mockResolvedValue(pendingOrder);

      const mockSavedPayment = {
        id: 'pay-1',
        tenantId,
        outletId,
        orderId: 'order-1',
        paymentMethod: 'CASH',
        amount: 100000,
        changeAmount: 45000,
        status: 'SUCCESS',
      };

      mockDataSource.transaction.mockImplementation(async (cb: any) => {
        const fakePaymentRepo = {
          create: jest.fn().mockImplementation((d) => d),
          save: jest.fn().mockResolvedValue(mockSavedPayment),
        };
        const fakeTrxRepo = {
          create: jest.fn().mockImplementation((d) => d),
          save: jest
            .fn()
            .mockResolvedValue({ id: 'trx-1', transactionNumber: 'TRX-001' }),
        };
        const fakeOrderRepo = {
          save: jest.fn().mockImplementation((o) => Promise.resolve(o)),
        };
        const fakeTableRepo = {
          findOne: jest.fn().mockResolvedValue(availableTable),
          save: jest.fn().mockImplementation((t) => Promise.resolve(t)),
        };
        const fakeStockRepo = {
          findOne: jest.fn().mockResolvedValue(null),
          save: jest.fn().mockResolvedValue(null),
        };
        const fakeMovementRepo = {
          create: jest.fn().mockImplementation((d) => d),
          save: jest.fn().mockResolvedValue(null),
        };
        const fakeRecipeRepo = {
          find: jest.fn().mockResolvedValue([]),
        };
        const fakePackagingRepo = {
          find: jest.fn().mockResolvedValue([]),
        };

        const fakeManager = {
          getRepository: jest.fn().mockImplementation((entity) => {
            if (entity === Payment) return fakePaymentRepo;
            if (entity === Transaction) return fakeTrxRepo;
            if (entity === Order) return fakeOrderRepo;
            if (entity === Table) return fakeTableRepo;
            if (entity === InventoryStock) return fakeStockRepo;
            if (entity === InventoryMovement) return fakeMovementRepo;
            if (entity === Recipe) return fakeRecipeRepo;
            if (entity === Packaging) return fakePackagingRepo;
            return {
              create: jest.fn((d) => d),
              save: jest.fn((d) => Promise.resolve(d)),
              find: jest.fn().mockResolvedValue([]),
              findOne: jest.fn().mockResolvedValue(null),
            };
          }),
        };
        return cb(fakeManager);
      });

      const result = await paymentService.create(tenantId, userId, {
        orderId: 'order-1',
        paymentMethod: 'CASH',
        amount: 100000,
      });

      expect(result).toBeDefined();
      expect(result.payment.amount).toBe(100000);
      expect(result.payment.changeAmount).toBe(45000); // 100k - 55k = 45k
      expect(mockDataSource.transaction).toHaveBeenCalled();
    });
  });
});
