import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { OrderController } from './order.controller';
import { OrderService } from '../services/order.service';
import { User } from '../../user/user.entity';

describe('OrderController', () => {
  let controller: OrderController;
  let orderService: jest.Mocked<Partial<OrderService>>;

  beforeEach(async () => {
    orderService = {
      findAll: jest.fn().mockResolvedValue({ items: [], meta: {} }),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      applyDiscount: jest.fn(),
      void: jest.fn(),
      addItems: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrderController],
      providers: [{ provide: OrderService, useValue: orderService }],
    }).compile();

    controller = module.get<OrderController>(OrderController);
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
      menuAccess: ['order.read', 'order.create'],
    },
  } as unknown as User;

  describe('findAll outlet scoping', () => {
    it('passes undefined (all outlets) when Super Admin requests ALL', async () => {
      await controller.findAll(superAdmin, { outletId: 'ALL' });

      expect(orderService.findAll).toHaveBeenCalledWith('tenant-1', {
        outletId: undefined,
      });
    });

    it('passes specific outlet when Super Admin selects Bims Outlet', async () => {
      await controller.findAll(superAdmin, { outletId: 'outlet-bims' });

      expect(orderService.findAll).toHaveBeenCalledWith('tenant-1', {
        outletId: 'outlet-bims',
      });
    });

    it('locks to assigned outlet when Cashier requests ALL', async () => {
      await controller.findAll(cashierDeilema, { outletId: 'ALL' });

      expect(orderService.findAll).toHaveBeenCalledWith('tenant-1', {
        outletId: 'outlet-deilema',
      });
    });

    it('blocks Cashier from querying other outlet (falls back to assigned outlet)', async () => {
      await controller.findAll(cashierDeilema, { outletId: 'outlet-bims' });

      expect(orderService.findAll).toHaveBeenCalledWith('tenant-1', {
        outletId: 'outlet-deilema',
      });
    });

    it('defaults to assigned outlet when Cashier omits outletId', async () => {
      await controller.findAll(cashierDeilema, {});

      expect(orderService.findAll).toHaveBeenCalledWith('tenant-1', {
        outletId: 'outlet-deilema',
      });
    });
  });

  describe('findById outlet scoping', () => {
    it('allows Super Admin to view order from any outlet', async () => {
      (orderService.findById as jest.Mock).mockResolvedValue({
        id: 'order-1',
        outletId: 'outlet-bims',
      });

      const result = await controller.findById(superAdmin, 'order-1');
      expect(result.data.id).toBe('order-1');
    });

    it('allows Cashier to view order from their own outlet', async () => {
      (orderService.findById as jest.Mock).mockResolvedValue({
        id: 'order-1',
        outletId: 'outlet-deilema',
      });

      const result = await controller.findById(cashierDeilema, 'order-1');
      expect(result.data.id).toBe('order-1');
    });

    it('blocks Cashier from viewing order of another outlet (throws NotFoundException)', async () => {
      (orderService.findById as jest.Mock).mockResolvedValue({
        id: 'order-1',
        outletId: 'outlet-bims',
      });

      await expect(
        controller.findById(cashierDeilema, 'order-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
