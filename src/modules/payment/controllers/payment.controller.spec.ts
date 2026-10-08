import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PaymentController } from './payment.controller';
import { PaymentService } from '../services/payment.service';
import { User } from '../../user/user.entity';

describe('PaymentController', () => {
  let controller: PaymentController;
  let paymentService: jest.Mocked<Partial<PaymentService>>;

  beforeEach(async () => {
    paymentService = {
      findPayments: jest.fn().mockResolvedValue({ items: [], meta: {} }),
      findTransactions: jest.fn().mockResolvedValue({ items: [], meta: {} }),
      findTransactionById: jest.fn(),
      create: jest.fn(),
      generateQris: jest.fn(),
      getQrisStatus: jest.fn(),
      checkQrisStatus: jest.fn(),
      simulateQrisPayment: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentController],
      providers: [{ provide: PaymentService, useValue: paymentService }],
    }).compile();

    controller = module.get<PaymentController>(PaymentController);
  });

  const superAdmin = {
    tenantId: 'tenant-1',
    outletId: null,
    isSuperAdmin: true,
    role: {
      name: 'Super Admin',
      menuAccess: ['*'],
    },
  } as unknown as User;

  const cashierDeilema = {
    tenantId: 'tenant-1',
    outletId: 'outlet-deilema',
    isSuperAdmin: false,
    role: {
      name: 'Kasir',
      menuAccess: ['transaction.read', 'payment.read'],
    },
  } as unknown as User;

  describe('findTransactions outlet scoping', () => {
    it('passes undefined (all outlets) when Super Admin requests ALL', async () => {
      await controller.findTransactions(superAdmin, { outletId: 'ALL' });

      expect(paymentService.findTransactions).toHaveBeenCalledWith('tenant-1', {
        outletId: undefined,
      });
    });

    it('passes specific outlet when Super Admin selects Bims Outlet', async () => {
      await controller.findTransactions(superAdmin, {
        outletId: 'outlet-bims',
      });

      expect(paymentService.findTransactions).toHaveBeenCalledWith('tenant-1', {
        outletId: 'outlet-bims',
      });
    });

    it('locks to assigned outlet when Cashier requests ALL', async () => {
      await controller.findTransactions(cashierDeilema, { outletId: 'ALL' });

      expect(paymentService.findTransactions).toHaveBeenCalledWith('tenant-1', {
        outletId: 'outlet-deilema',
      });
    });

    it('blocks Cashier from querying other outlet (falls back to assigned outlet)', async () => {
      await controller.findTransactions(cashierDeilema, {
        outletId: 'outlet-bims',
      });

      expect(paymentService.findTransactions).toHaveBeenCalledWith('tenant-1', {
        outletId: 'outlet-deilema',
      });
    });
  });

  describe('findTransactionById outlet scoping', () => {
    it('allows Super Admin to view transaction from any outlet', async () => {
      (paymentService.findTransactionById as jest.Mock).mockResolvedValue({
        id: 'trx-1',
        outletId: 'outlet-bims',
      });

      const result = await controller.findTransactionById(superAdmin, 'trx-1');
      expect(result.data.id).toBe('trx-1');
    });

    it('allows Cashier to view transaction from their own outlet', async () => {
      (paymentService.findTransactionById as jest.Mock).mockResolvedValue({
        id: 'trx-1',
        outletId: 'outlet-deilema',
      });

      const result = await controller.findTransactionById(
        cashierDeilema,
        'trx-1',
      );
      expect(result.data.id).toBe('trx-1');
    });

    it('blocks Cashier from viewing transaction of another outlet (throws NotFoundException)', async () => {
      (paymentService.findTransactionById as jest.Mock).mockResolvedValue({
        id: 'trx-1',
        outletId: 'outlet-bims',
      });

      await expect(
        controller.findTransactionById(cashierDeilema, 'trx-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
