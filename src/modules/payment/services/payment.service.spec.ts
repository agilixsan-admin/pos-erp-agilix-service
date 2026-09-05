import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { BadRequestException } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { Payment } from '../entities/payment.entity';
import { Transaction } from '../entities/transaction.entity';
import { Order } from '../../order/entities/order.entity';
import { Recipe } from '../../recipe/entities/recipe.entity';
import { InventoryStock } from '../../inventory/entities/inventory-stock.entity';
import { InventoryMovement } from '../../inventory/entities/inventory-movement.entity';
import { Table } from '../../table/entities/table.entity';
import { AuditService } from '../../audit/audit.service';
import { QRIS_PROVIDER_TOKEN } from '../interfaces/qris-provider.interface';

describe('PaymentService', () => {
  let service: PaymentService;

  const mockPaymentRepo = {
    createQueryBuilder: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
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

  const mockQrisProvider = {
    providerName: 'mock',
    generateQris: jest.fn(),
    checkStatus: jest.fn(),
    verifyWebhookSignature: jest.fn(),
    parseWebhookPayload: jest.fn(),
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
          provide: QRIS_PROVIDER_TOKEN,
          useValue: mockQrisProvider,
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

  describe('create (CASH)', () => {
    it('processes cash payment, finalizes order, creates transaction and deducts recipe stock', async () => {
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
            quantity: 18,
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
      const managerTableRepo = {
        findOne: jest.fn(),
        save: jest.fn(),
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
              if (entityClass === Table) return managerTableRepo;
              return managerAuditRepo;
            },
          });
        },
      );

      const result = await service.create('tenant-1', 'user-1', {
        orderId: 'ord-1',
        paymentMethod: 'CASH',
        amount: 60000,
      });

      expect(result.payment.changeAmount).toBe(10000);
      expect(result.order.status).toBe('COMPLETED');
      expect(mockDataSource.transaction).toHaveBeenCalled();
    });

    it('releases occupied table when payment completes for order with tableId', async () => {
      const order = {
        id: 'ord-1',
        tenantId: 'tenant-1',
        outletId: 'outlet-1',
        orderNumber: 'ORD-123',
        status: 'PENDING',
        totalAmount: 50000,
        tableId: 'tbl-1',
        items: [],
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
        find: jest.fn().mockResolvedValue([]),
      };
      const managerStockRepo = {
        findOne: jest.fn(),
        save: jest.fn(),
      };
      const managerMovementRepo = {
        create: jest.fn(),
        save: jest.fn(),
      };
      const managerTableRepo = {
        findOne: jest.fn().mockResolvedValue({
          id: 'tbl-1',
          status: 'OCCUPIED',
        }),
        save: jest.fn((t: Record<string, unknown>) => Promise.resolve(t)),
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
              if (entityClass === Table) return managerTableRepo;
              return managerAuditRepo;
            },
          });
        },
      );

      const result = await service.create('tenant-1', 'user-1', {
        orderId: 'ord-1',
        paymentMethod: 'CASH',
        amount: 50000,
      });

      expect(result.order.status).toBe('COMPLETED');
      expect(managerTableRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'tbl-1',
          status: 'AVAILABLE',
        }),
      );
    });
  });

  describe('generateQris', () => {
    it('generates dynamic QRIS for a pending order', async () => {
      const order = {
        id: 'ord-1',
        tenantId: 'tenant-1',
        outletId: 'outlet-1',
        orderNumber: 'ORD-123',
        status: 'PENDING',
        totalAmount: 50000,
      };
      mockOrderRepo.findOne.mockResolvedValue(order);
      mockPaymentRepo.findOne.mockResolvedValue(null); // no existing pending QR

      mockQrisProvider.generateQris.mockResolvedValue({
        qrString: '00020101...540550000',
        qrUrl: 'https://api.qrserver.com/test.png',
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        gatewayProvider: 'mock',
        gatewayReference: 'MOCK-QR-ORD-123',
      });

      const paymentRecord = {
        id: 'pay-qris-1',
        tenantId: 'tenant-1',
        orderId: 'ord-1',
        status: 'PENDING',
        qrString: '00020101...540550000',
      };
      mockPaymentRepo.create.mockReturnValue(paymentRecord);
      mockPaymentRepo.save.mockResolvedValue(paymentRecord);

      const result = await service.generateQris('tenant-1', 'user-1', {
        orderId: 'ord-1',
      });

      expect(result.qrString).toBe('00020101...540550000');
      expect(mockQrisProvider.generateQris).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: 'ord-1',
          amount: 50000,
        }),
      );
      expect(mockPaymentRepo.save).toHaveBeenCalled();
    });

    it('returns existing unexpired pending QRIS if already generated', async () => {
      const futureDate = new Date(Date.now() + 10 * 60 * 1000);
      const order = {
        id: 'ord-1',
        tenantId: 'tenant-1',
        status: 'PENDING',
        totalAmount: 50000,
      };
      const existing = {
        id: 'pay-existing',
        orderId: 'ord-1',
        status: 'PENDING',
        expiresAt: futureDate,
        qrString: 'EXISTING_QR',
        qrUrl: 'http://qr.png',
      };

      mockOrderRepo.findOne.mockResolvedValue(order);
      mockPaymentRepo.findOne.mockResolvedValue(existing);

      const result = await service.generateQris('tenant-1', 'user-1', {
        orderId: 'ord-1',
      });

      expect(result.qrString).toBe('EXISTING_QR');
      expect(mockQrisProvider.generateQris).not.toHaveBeenCalled();
    });

    it('rejects QRIS generation if order is already completed', async () => {
      mockOrderRepo.findOne.mockResolvedValue({
        id: 'ord-1',
        status: 'COMPLETED',
      });

      await expect(
        service.generateQris('tenant-1', 'user-1', { orderId: 'ord-1' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getQrisStatus', () => {
    it('returns latest QRIS status and marks EXPIRED if past expiry', async () => {
      const pastDate = new Date(Date.now() - 60000);
      const payment = {
        id: 'pay-1',
        orderId: 'ord-1',
        status: 'PENDING',
        amount: 50000,
        expiresAt: pastDate,
        paidAt: null,
      };
      mockPaymentRepo.findOne.mockResolvedValue(payment);
      mockPaymentRepo.save.mockResolvedValue({ ...payment, status: 'EXPIRED' });

      const result = await service.getQrisStatus('tenant-1', 'ord-1');
      expect(result.status).toBe('EXPIRED');
      expect(mockPaymentRepo.save).toHaveBeenCalled();
    });
  });

  describe('checkQrisStatus (Cashier Inquiry)', () => {
    it('triggers settlement when gateway reports SUCCESS', async () => {
      const payment = {
        id: 'pay-1',
        tenantId: 'tenant-1',
        orderId: 'ord-1',
        status: 'PENDING',
        gatewayReference: 'QR-REF-1',
      };
      mockPaymentRepo.findOne.mockResolvedValue(payment);

      mockQrisProvider.checkStatus.mockResolvedValue({
        status: 'SUCCESS',
        paidAt: new Date(),
      });

      // Mock settlePayment transaction
      const settleSpy = jest.spyOn(service, 'settlePayment').mockResolvedValue({
        payment: { ...payment, status: 'SUCCESS' },
      } as unknown as {
        payment: Payment;
        transaction: Transaction;
        order: Order;
      });

      const result = await service.checkQrisStatus(
        'tenant-1',
        'user-1',
        'ord-1',
      );

      expect(settleSpy).toHaveBeenCalledWith(
        'pay-1',
        'tenant-1',
        'user-1',
        expect.any(Date),
      );
      expect(result.payment.status).toBe('SUCCESS');
    });
  });

  describe('processGatewayWebhook', () => {
    it('rejects webhook when signature is invalid', async () => {
      mockQrisProvider.verifyWebhookSignature.mockReturnValue(false);

      await expect(
        service.processGatewayWebhook({}, { order_id: '123' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('processes settlement when webhook signature is valid and status is SUCCESS', async () => {
      mockQrisProvider.verifyWebhookSignature.mockReturnValue(true);
      mockQrisProvider.parseWebhookPayload.mockReturnValue({
        gatewayReference: 'QR-REF-1',
        status: 'SUCCESS',
        paidAt: new Date(),
        orderId: '',
        rawPayload: {},
      });

      mockPaymentRepo.findOne.mockResolvedValue({
        id: 'pay-1',
        tenantId: 'tenant-1',
        gatewayReference: 'QR-REF-1',
      });

      const settleSpy = jest.spyOn(service, 'settlePayment').mockResolvedValue({
        payment: { id: 'pay-1', status: 'SUCCESS' },
      } as unknown as {
        payment: Payment;
        transaction: Transaction;
        order: Order;
      });

      const result = await service.processGatewayWebhook(
        {},
        { order_id: 'QR-REF-1' },
      );

      expect(settleSpy).toHaveBeenCalledWith(
        'pay-1',
        'tenant-1',
        null,
        expect.any(Date),
      );
      expect(result).toBeDefined();
    });
  });

  describe('simulateQrisPayment', () => {
    it('simulates payment settlement for pending payment in sandbox', async () => {
      mockPaymentRepo.findOne.mockResolvedValue({
        id: 'pay-1',
        tenantId: 'tenant-1',
        status: 'PENDING',
      });

      const settleSpy = jest.spyOn(service, 'settlePayment').mockResolvedValue({
        payment: { id: 'pay-1', status: 'SUCCESS' },
      } as unknown as {
        payment: Payment;
        transaction: Transaction;
        order: Order;
      });

      const result = await service.simulateQrisPayment(
        'tenant-1',
        'user-1',
        'pay-1',
      );

      expect(settleSpy).toHaveBeenCalledWith(
        'pay-1',
        'tenant-1',
        'user-1',
        expect.any(Date),
      );
      expect(result).toBeDefined();
    });

    it('rejects simulation if payment is not PENDING', async () => {
      mockPaymentRepo.findOne.mockResolvedValue({
        id: 'pay-1',
        tenantId: 'tenant-1',
        status: 'SUCCESS',
      });

      await expect(
        service.simulateQrisPayment('tenant-1', 'user-1', 'pay-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
