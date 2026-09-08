import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  BadGatewayException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrinterService } from './printer.service';
import { Printer } from '../entities/printer.entity';
import { PrinterCategoryRouting } from '../entities/printer-category-routing.entity';
import { Category } from '../../product/entities/category.entity';
import { Outlet } from '../../outlet/outlet.entity';
import { Order } from '../../order/entities/order.entity';
import { Payment } from '../../payment/entities/payment.entity';
import { AuditService } from '../../audit/audit.service';
import { EscPosBuilderService } from './escpos-builder.service';
import { NetworkPrinterDriver } from './network-printer.driver';
import { SettingsService } from '../../settings/services/settings.service';

describe('PrinterService', () => {
  let service: PrinterService;
  let printerRepo: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    findOneOrFail: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let routingRepo: {
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    delete: jest.Mock;
  };
  let categoryRepo: {
    find: jest.Mock;
    findOne: jest.Mock;
  };
  let outletRepo: {
    findOne: jest.Mock;
  };
  let orderRepo: {
    findOne: jest.Mock;
  };
  let paymentRepo: {
    find: jest.Mock;
  };
  let auditService: {
    record: jest.Mock;
  };
  let escposBuilder: {
    buildReceipt: jest.Mock;
    buildKitchenTicket: jest.Mock;
    buildBarTicket: jest.Mock;
    buildStationTicket: jest.Mock;
    buildTestSlip: jest.Mock;
  };
  let networkDriver: {
    send: jest.Mock;
  };
  let dataSource: {
    transaction: jest.Mock;
  };
  let settingsService: {
    getSettings: jest.Mock;
  };

  const mockTenantId = 'tenant-uuid-1';
  const mockOutletId = 'outlet-uuid-1';
  const mockUserId = 'user-uuid-1';

  beforeEach(async () => {
    settingsService = {
      getSettings: jest.fn().mockResolvedValue({
        taxName: 'PB1',
        billFooterText: 'Thank you for your visit!',
      }),
    };

    printerRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(
        (dto: Partial<Printer>) =>
          ({ ...dto, id: 'printer-uuid-1' }) as Printer,
      ),
      save: jest.fn((entity: Partial<Printer>) =>
        Promise.resolve({
          ...entity,
          id: entity.id || 'printer-uuid-1',
        } as Printer),
      ),
      update: jest.fn(),
      delete: jest.fn(),
      findOneOrFail: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    routingRepo = {
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((dto: Partial<PrinterCategoryRouting>) => ({
        ...dto,
        id: 'routing-1',
      })),
      save: jest.fn((entities: unknown) => Promise.resolve(entities)),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    categoryRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
    };

    outletRepo = {
      findOne: jest.fn(),
    };

    orderRepo = {
      findOne: jest.fn(),
    };

    paymentRepo = {
      find: jest.fn().mockResolvedValue([]),
    };

    auditService = {
      record: jest.fn(),
    };

    escposBuilder = {
      buildReceipt: jest.fn().mockReturnValue({
        buffer: Buffer.from('receipt bytes'),
        base64: Buffer.from('receipt bytes').toString('base64'),
        rawText: 'Receipt content',
      }),
      buildKitchenTicket: jest.fn().mockReturnValue({
        buffer: Buffer.from('kitchen bytes'),
        base64: Buffer.from('kitchen bytes').toString('base64'),
        rawText: 'Kitchen ticket',
      }),
      buildBarTicket: jest.fn().mockReturnValue({
        buffer: Buffer.from('bar bytes'),
        base64: Buffer.from('bar bytes').toString('base64'),
        rawText: 'Bar ticket',
      }),
      buildStationTicket: jest.fn().mockReturnValue({
        buffer: Buffer.from('station bytes'),
        base64: Buffer.from('station bytes').toString('base64'),
        rawText: 'Station ticket',
      }),
      buildTestSlip: jest.fn().mockReturnValue({
        buffer: Buffer.from('test bytes'),
        base64: Buffer.from('test bytes').toString('base64'),
        rawText: 'Test slip content',
      }),
    };

    networkDriver = {
      send: jest.fn(),
    };

    dataSource = {
      transaction: jest.fn(
        <T>(
          cb: (manager: {
            getRepository: (entity: unknown) => unknown;
          }) => Promise<T>,
        ) => {
          const mockManager = {
            getRepository: (target: unknown) => {
              if (target === PrinterCategoryRouting) return routingRepo;
              return printerRepo;
            },
          };
          return cb(mockManager);
        },
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrinterService,
        { provide: getRepositoryToken(Printer), useValue: printerRepo },
        {
          provide: getRepositoryToken(PrinterCategoryRouting),
          useValue: routingRepo,
        },
        { provide: getRepositoryToken(Category), useValue: categoryRepo },
        { provide: getRepositoryToken(Outlet), useValue: outletRepo },
        { provide: getRepositoryToken(Order), useValue: orderRepo },
        { provide: getRepositoryToken(Payment), useValue: paymentRepo },
        { provide: DataSource, useValue: dataSource },
        { provide: AuditService, useValue: auditService },
        { provide: EscPosBuilderService, useValue: escposBuilder },
        { provide: NetworkPrinterDriver, useValue: networkDriver },
        { provide: SettingsService, useValue: settingsService },
      ],
    }).compile();

    service = module.get<PrinterService>(PrinterService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('returns list of printers filtered by tenant and query options', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([{ id: 'printer-1' }]),
      };
      printerRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.findAll(mockTenantId, {
        outletId: mockOutletId,
        type: 'RECEIPT',
        connectionType: 'BLUETOOTH',
        status: 'ACTIVE',
      });

      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'printer.tenantId = :tenantId',
        { tenantId: mockTenantId },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'printer.outletId = :outletId',
        { outletId: mockOutletId },
      );
      expect(result).toHaveLength(1);
    });
  });

  describe('findById', () => {
    it('returns printer when found', async () => {
      const mockPrinter = { id: 'p-1', tenantId: mockTenantId };
      printerRepo.findOne.mockResolvedValue(mockPrinter);

      const result = await service.findById(mockTenantId, 'p-1');
      expect(result).toEqual(mockPrinter);
    });

    it('throws NotFoundException when printer does not exist', async () => {
      printerRepo.findOne.mockResolvedValue(null);
      await expect(
        service.findById(mockTenantId, 'non-existent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('creates a printer and records audit log', async () => {
      outletRepo.findOne.mockResolvedValue({ id: mockOutletId });

      const dto = {
        outletId: mockOutletId,
        name: 'Kasir Utama',
        type: 'RECEIPT' as const,
        connectionType: 'BLUETOOTH' as const,
        paperSize: '58mm' as const,
        isDefault: true,
      };

      const result = await service.create(mockTenantId, dto, mockUserId);

      expect(result.id).toBe('printer-uuid-1');
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PRINTER_CREATED',
          tenantId: mockTenantId,
        }),
      );
    });

    it('throws NotFoundException when outlet is not found', async () => {
      outletRepo.findOne.mockResolvedValue(null);
      await expect(
        service.create(
          mockTenantId,
          {
            outletId: 'non-existent',
            name: 'P',
            type: 'RECEIPT',
            connectionType: 'USB',
          },
          mockUserId,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException if connectionType is NETWORK without ipAddress', async () => {
      outletRepo.findOne.mockResolvedValue({ id: mockOutletId });
      await expect(
        service.create(
          mockTenantId,
          {
            outletId: mockOutletId,
            name: 'P',
            type: 'RECEIPT',
            connectionType: 'NETWORK',
          },
          mockUserId,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('testPrint', () => {
    it('generates test slip and returns READY_TO_PRINT for bluetooth printer', async () => {
      const mockPrinter = {
        id: 'p-test',
        name: 'Printer Dapur BT',
        type: 'KITCHEN',
        connectionType: 'BLUETOOTH',
        paperSize: '58mm',
        bluetoothMac: '66:32:B1:8A:22:90',
        outlet: { name: 'Agilix Cafe Pusat' },
      };
      printerRepo.findOne.mockResolvedValue(mockPrinter);

      const result = await service.testPrint(
        mockTenantId,
        'p-test',
        mockUserId,
      );

      expect(escposBuilder.buildTestSlip).toHaveBeenCalledWith(
        expect.objectContaining({
          outletName: 'Agilix Cafe Pusat',
          printerName: 'Printer Dapur BT',
          stationType: 'KITCHEN',
          connectionType: 'BLUETOOTH',
        }),
      );
      expect(result.status).toBe('READY_TO_PRINT');
      expect(result.escposPayload).toBeDefined();
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PRINTER_TEST_PRINTED',
        }),
      );
    });

    it('sends via socket driver for network printer and returns SENT', async () => {
      const mockPrinter = {
        id: 'p-net',
        name: 'Printer Bar LAN',
        type: 'BAR',
        connectionType: 'NETWORK',
        paperSize: '80mm',
        ipAddress: '192.168.1.60',
        port: 9100,
        outlet: { name: 'Outlet 1' },
      };
      printerRepo.findOne.mockResolvedValue(mockPrinter);
      networkDriver.send.mockResolvedValue(undefined);

      const result = await service.testPrint(mockTenantId, 'p-net', mockUserId);

      expect(networkDriver.send).toHaveBeenCalledWith(
        expect.objectContaining({
          ipAddress: '192.168.1.60',
          port: 9100,
        }),
      );
      expect(result.status).toBe('SENT');
    });

    it('throws BadGatewayException when network test print fails', async () => {
      const mockPrinter = {
        id: 'p-net',
        name: 'Printer Bar LAN',
        type: 'BAR',
        connectionType: 'NETWORK',
        paperSize: '80mm',
        ipAddress: '192.168.1.60',
        port: 9100,
        outlet: { name: 'Outlet 1' },
      };
      printerRepo.findOne.mockResolvedValue(mockPrinter);
      networkDriver.send.mockRejectedValue(new Error('Connection timed out'));

      await expect(
        service.testPrint(mockTenantId, 'p-net', mockUserId),
      ).rejects.toThrow(BadGatewayException);
    });
  });

  describe('routing rules (getRoutingRules & setRoutingRules)', () => {
    it('returns routing rules for outlet categories', async () => {
      outletRepo.findOne.mockResolvedValue({ id: mockOutletId });
      categoryRepo.find.mockResolvedValue([
        { id: 'cat-food', name: 'Makanan' },
        { id: 'cat-drink', name: 'Minuman' },
      ]);
      printerRepo.find.mockResolvedValue([
        { id: 'pr-kitchen', name: 'Kitchen Printer', type: 'KITCHEN' },
        { id: 'pr-bar', name: 'Bar Printer', type: 'BAR' },
      ]);
      routingRepo.find.mockResolvedValue([
        {
          categoryId: 'cat-food',
          printerId: 'pr-kitchen',
          printer: { name: 'Kitchen Printer', type: 'KITCHEN' },
        },
      ]);

      const result = await service.getRoutingRules(mockTenantId, mockOutletId);

      expect(result.outletId).toBe(mockOutletId);
      expect(result.printers).toHaveLength(2);
      expect(result.rules).toHaveLength(2);
      expect(result.rules[0]).toEqual({
        categoryId: 'cat-food',
        categoryName: 'Makanan',
        printerId: 'pr-kitchen',
        printerName: 'Kitchen Printer',
        stationType: 'KITCHEN',
      });
      expect(result.rules[1].printerId).toBeNull();
    });

    it('updates routing rules successfully in transaction', async () => {
      outletRepo.findOne.mockResolvedValue({ id: mockOutletId });
      printerRepo.find.mockResolvedValue([
        { id: 'pr-kitchen', outletId: mockOutletId },
        { id: 'pr-bar', outletId: mockOutletId },
      ]);
      categoryRepo.find.mockResolvedValue([
        { id: 'cat-food', name: 'Makanan' },
        { id: 'cat-drink', name: 'Minuman' },
      ]);

      const dto = {
        outletId: mockOutletId,
        routings: [
          { categoryId: 'cat-food', printerId: 'pr-kitchen' },
          { categoryId: 'cat-drink', printerId: 'pr-bar' },
        ],
      };

      const result = await service.setRoutingRules(
        mockTenantId,
        dto,
        mockUserId,
      );

      expect(routingRepo.delete).toHaveBeenCalledWith({
        tenantId: mockTenantId,
        outletId: mockOutletId,
      });
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PRINTER_ROUTING_UPDATED',
        }),
      );
      expect(result).toBeDefined();
    });
  });

  describe('dispatchOrder (Smart Dispatch Engine)', () => {
    it('handles Scenario 1: Single Active Printer mode (UMKM fallback)', async () => {
      const mockOrder = {
        id: 'ord-single-1',
        orderNumber: 'ORD-001',
        status: 'COMPLETED',
        outletId: mockOutletId,
        items: [
          { productName: 'Nasi Goreng', quantity: 1 },
          { productName: 'Es Teh', quantity: 1 },
        ],
      };
      orderRepo.findOne.mockResolvedValue(mockOrder);

      const singlePrinter = {
        id: 'p-single',
        name: 'Single Cashier Printer',
        type: 'RECEIPT',
        connectionType: 'BLUETOOTH',
        paperSize: '58mm',
        status: 'ACTIVE',
      };
      printerRepo.find.mockResolvedValue([singlePrinter]);

      const result = await service.dispatchOrder(
        mockTenantId,
        'ord-single-1',
        {},
        mockUserId,
        'Kasir 1',
      );

      expect(result.isSinglePrinterMode).toBe(true);
      expect(result.printJobs).toHaveLength(1);
      expect(result.printJobs[0].printerId).toBe('p-single');
      expect(result.printJobs[0].itemCount).toBe(2);
      expect(escposBuilder.buildReceipt).toHaveBeenCalled();
    });

    it('handles Scenario 2: Multi-Printer Station & Category Routing', async () => {
      const mockOrder = {
        id: 'ord-multi-1',
        orderNumber: 'ORD-002',
        status: 'COMPLETED',
        outletId: mockOutletId,
        items: [
          {
            id: 'item-food-1',
            productName: 'Nasi Goreng Spesial',
            quantity: 2,
            product: { categoryId: 'cat-food' },
          },
          {
            id: 'item-drink-1',
            productName: 'Matcha Latte',
            quantity: 1,
            product: { categoryId: 'cat-drink' },
          },
        ],
      };
      orderRepo.findOne.mockResolvedValue(mockOrder);

      const kitchenPrinter = {
        id: 'p-kitchen',
        name: 'Kitchen Station',
        type: 'KITCHEN',
        connectionType: 'BLUETOOTH',
        paperSize: '58mm',
        status: 'ACTIVE',
      };
      const barPrinter = {
        id: 'p-bar',
        name: 'Bar Station',
        type: 'BAR',
        connectionType: 'BLUETOOTH',
        paperSize: '58mm',
        status: 'ACTIVE',
      };
      const receiptPrinter = {
        id: 'p-receipt',
        name: 'Cashier Station',
        type: 'RECEIPT',
        connectionType: 'BLUETOOTH',
        paperSize: '58mm',
        status: 'ACTIVE',
        isDefault: true,
      };

      printerRepo.find.mockResolvedValue([
        kitchenPrinter,
        barPrinter,
        receiptPrinter,
      ]);

      routingRepo.find.mockResolvedValue([
        { categoryId: 'cat-food', printer: kitchenPrinter },
        { categoryId: 'cat-drink', printer: barPrinter },
      ]);

      const result = await service.dispatchOrder(
        mockTenantId,
        'ord-multi-1',
        { mode: 'AUTO' },
        mockUserId,
      );

      expect(result.isSinglePrinterMode).toBe(false);
      // Expected 3 jobs: Kitchen ticket (food), Bar ticket (drink), and Customer Receipt
      expect(result.printJobs).toHaveLength(3);

      const kitchenJob = result.printJobs.find((j) => j.station === 'KITCHEN');
      const barJob = result.printJobs.find((j) => j.station === 'BAR');
      const receiptJob = result.printJobs.find((j) => j.station === 'RECEIPT');

      expect(kitchenJob).toBeDefined();
      expect(kitchenJob!.itemCount).toBe(1);
      expect(escposBuilder.buildKitchenTicket).toHaveBeenCalled();

      expect(barJob).toBeDefined();
      expect(barJob!.itemCount).toBe(1);
      expect(escposBuilder.buildBarTicket).toHaveBeenCalled();

      expect(receiptJob).toBeDefined();
      expect(escposBuilder.buildReceipt).toHaveBeenCalled();
    });

    it('throws NotFoundException if no active printers are configured for outlet', async () => {
      orderRepo.findOne.mockResolvedValue({
        id: 'ord-1',
        outletId: mockOutletId,
      });
      printerRepo.find.mockResolvedValue([]);

      await expect(
        service.dispatchOrder(mockTenantId, 'ord-1', {}, mockUserId),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
