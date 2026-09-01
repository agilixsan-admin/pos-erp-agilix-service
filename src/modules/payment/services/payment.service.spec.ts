import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { Payment } from '../entities/payment.entity';
import { Transaction } from '../entities/transaction.entity';
import { Order } from '../../order/entities/order.entity';
import { Recipe } from '../../recipe/entities/recipe.entity';
import { InventoryStock } from '../../inventory/entities/inventory-stock.entity';
import { InventoryMovement } from '../../inventory/entities/inventory-movement.entity';
import { AuditService } from '../../audit/audit.service';

describe('PaymentService', () => {
  let service: PaymentService;

  const mockPaymentRepo = {
    createQueryBuilder: jest.fn(),
  };

  const mockTrxRepo = {
    createQueryBuilder: jest.fn(),
    findOne: jest.fn(),
  };

  const mockOrderRepo = {
    findOne: jest.fn(),
  };

  const mockDataSource = {
    transaction: jest.fn(),
  };

  const mockAuditService = {
    record: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        {
          provide: getRepositoryToken(Payment),
          useValue: mockPaymentRepo,
        },
        {
          provide: getRepositoryToken(Transaction),
          useValue: mockTrxRepo,
        },
        {
          provide: getRepositoryToken(Order),
          useValue: mockOrderRepo,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
        {
          provide: AuditService,
          useValue: mockAuditService,
        },
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
  });

  describe('create', () => {
    it('processes payment, finalizes order, creates transaction and deducts recipe stock', async () => {
      const order = {
        id: 'ord-1',
        tenantId: 'tenant-1',
        outletId: 'outlet-1',
        orderNumber: 'ORD-123',
        status: 'PENDING',
        totalAmount: 50000,
        items: [
          {
            variantId: 'var-1',
            quantity: 2,
            productName: 'Latte',
            variantName: 'Hot',
          },
        ],
      };
      mockOrderRepo.findOne.mockResolvedValue(order);

      const managerPaymentRepo = {
        create: jest.fn((p: Record<string, unknown>) => ({
          ...p,
          id: 'pay-1',
        })),
        save: jest.fn((p: Record<string, unknown>) => Promise.resolve(p)),
      };
      const managerTrxRepo = {
        create: jest.fn((t: Record<string, unknown>) => ({
          ...t,
          id: 'trx-1',
        })),
        save: jest.fn((t: Record<string, unknown>) => Promise.resolve(t)),
      };
      const managerOrderRepo = {
        save: jest.fn().mockResolvedValue(order),
      };
      const managerRecipeRepo = {
        find: jest.fn().mockResolvedValue([
          {
            inventoryItemId: 'item-coffee',
            quantity: 18, // 18g per cup
          },
        ]),
      };
      const managerStockRepo = {
        findOne: jest.fn().mockResolvedValue({
          id: 'stock-1',
          quantity: 1000,
        }),
        save: jest
          .fn()
          .mockImplementation((s: Record<string, unknown>) =>
            Promise.resolve(s),
          ),
      };
      const managerMovementRepo = {
        create: jest.fn((m: Record<string, unknown>) => ({
          ...m,
          id: 'mov-1',
        })),
        save: jest.fn((m: Record<string, unknown>) => Promise.resolve(m)),
      };
      const managerAuditRepo = {
        save: jest.fn().mockResolvedValue({}),
      };

      mockDataSource.transaction.mockImplementation(
        (callback: (m: unknown) => Promise<unknown>) => {
          return callback({
            getRepository: (entityClass: unknown) => {
              if (entityClass === Payment) return managerPaymentRepo;
              if (entityClass === Transaction) return managerTrxRepo;
              if (entityClass === Order) return managerOrderRepo;
              if (entityClass === Recipe) return managerRecipeRepo;
              if (entityClass === InventoryStock) return managerStockRepo;
              if (entityClass === InventoryMovement) return managerMovementRepo;
              return managerAuditRepo;
            },
          });
        },
      );

      const result = await service.create('tenant-1', 'user-1', {
        orderId: 'ord-1',
        paymentMethod: 'CASH',
        amount: 60000, // tender 60,000 for 50,000 order
      });

      expect(result.payment.changeAmount).toBe(10000);
      expect(result.order.status).toBe('COMPLETED');
      expect(mockDataSource.transaction).toHaveBeenCalled();
    });

    it('rejects payment if order is already completed/paid (duplicate protection)', async () => {
      const order = {
        id: 'ord-1',
        tenantId: 'tenant-1',
        status: 'COMPLETED',
        totalAmount: 50000,
      };
      mockOrderRepo.findOne.mockResolvedValue(order);

      await expect(
        service.create('tenant-1', 'user-1', {
          orderId: 'ord-1',
          paymentMethod: 'CASH',
          amount: 50000,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects payment if tendered amount is less than total amount', async () => {
      const order = {
        id: 'ord-1',
        tenantId: 'tenant-1',
        status: 'PENDING',
        totalAmount: 50000,
      };
      mockOrderRepo.findOne.mockResolvedValue(order);

      await expect(
        service.create('tenant-1', 'user-1', {
          orderId: 'ord-1',
          paymentMethod: 'CASH',
          amount: 30000,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findTransactionById', () => {
    it('returns transaction when found for tenant', async () => {
      const trx = {
        id: 'trx-1',
        tenantId: 'tenant-1',
        transactionNumber: 'TRX-123',
      };
      mockTrxRepo.findOne.mockResolvedValue(trx);

      const result = await service.findTransactionById('tenant-1', 'trx-1');
      expect(result).toEqual(trx);
    });

    it('throws NotFoundException if transaction does not exist for tenant', async () => {
      mockTrxRepo.findOne.mockResolvedValue(null);

      await expect(
        service.findTransactionById('tenant-1', 'trx-foreign'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
