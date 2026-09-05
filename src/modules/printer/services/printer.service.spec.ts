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
import { Outlet } from '../../outlet/outlet.entity';
import { Order } from '../../order/entities/order.entity';
import { Payment } from '../../payment/entities/payment.entity';
import { AuditService } from '../../audit/audit.service';
import { EscPosBuilderService } from './escpos-builder.service';
import { NetworkPrinterDriver } from './network-printer.driver';

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
  };
  let networkDriver: {
    send: jest.Mock;
  };
  let dataSource: {
    transaction: jest.Mock;
  };

  const mockTenantId = 'tenant-uuid-1';
  const mockOutletId = 'outlet-uuid-1';
  const mockUserId = 'user-uuid-1';

  beforeEach(async () => {
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

    outletRepo = {
      findOne: jest.fn(),
    };

    orderRepo = {
      findOne: jest.fn(),
    };

    paymentRepo = {
      find: jest.fn(),
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
    };

    networkDriver = {
      send: jest.fn(),
    };

    dataSource = {
      transaction: jest.fn(
        <T>(
          cb: (manager: {
            getRepository: () => typeof printerRepo;
          }) => Promise<T>,
        ) => {
          const mockManager = {
            getRepository: () => printerRepo,
          };
          return cb(mockManager);
        },
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrinterService,
        { provide: getRepositoryToken(Printer), useValue: printerRepo },
        { provide: getRepositoryToken(Outlet), useValue: outletRepo },
        { provide: getRepositoryToken(Order), useValue: orderRepo },
        { provide: getRepositoryToken(Payment), useValue: paymentRepo },
        { provide: DataSource, useValue: dataSource },
        { provide: AuditService, useValue: auditService },
        { provide: EscPosBuilderService, useValue: escposBuilder },
        { provide: NetworkPrinterDriver, useValue: networkDriver },
      ],
    }).compile();

    service = module.get<PrinterService>(PrinterService);
  });

  describe('findAll', () => {
    it('returns list of printers for tenant', async () => {
      const qb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest
          .fn()
          .mockResolvedValue([{ id: 'p-1', name: 'Printer 1' }]),
      };
      printerRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll(mockTenantId, {
        outletId: mockOutletId,
      });
      expect(result).toHaveLength(1);
      expect(qb.where).toHaveBeenCalledWith('printer.tenantId = :tenantId', {
        tenantId: mockTenantId,
      });
      expect(qb.andWhere).toHaveBeenCalledWith('printer.outletId = :outletId', {
        outletId: mockOutletId,
      });
    });
  });

  describe('findById', () => {
    it('returns printer when found', async () => {
      printerRepo.findOne.mockResolvedValue({ id: 'p-1', name: 'Printer 1' });
      const result = await service.findById(mockTenantId, 'p-1');
      expect(result.id).toBe('p-1');
    });

    it('throws NotFoundException when printer not found', async () => {
      printerRepo.findOne.mockResolvedValue(null);
      await expect(
        service.findById(mockTenantId, 'p-nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('throws NotFoundException if outlet not found', async () => {
      outletRepo.findOne.mockResolvedValue(null);
      await expect(
        service.create(
          mockTenantId,
          {
            outletId: 'bad-outlet',
            name: 'Cashier Printer',
            type: 'RECEIPT',
            connectionType: 'BLUETOOTH',
          },
          mockUserId,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException if NETWORK connection lacks ipAddress', async () => {
      outletRepo.findOne.mockResolvedValue({ id: mockOutletId });
      await expect(
        service.create(
          mockTenantId,
          {
            outletId: mockOutletId,
            name: 'LAN Printer',
            type: 'RECEIPT',
            connectionType: 'NETWORK',
          },
          mockUserId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates Bluetooth printer with isDefault resetting other defaults', async () => {
      outletRepo.findOne.mockResolvedValue({ id: mockOutletId });

      const result = await service.create(
        mockTenantId,
        {
          outletId: mockOutletId,
          name: 'Bluetooth Cashier',
          type: 'RECEIPT',
          connectionType: 'BLUETOOTH',
          paperSize: '58mm',
          isDefault: true,
        },
        mockUserId,
      );

      expect(dataSource.transaction).toHaveBeenCalled();
      expect(printerRepo.update).toHaveBeenCalledWith(
        {
          tenantId: mockTenantId,
          outletId: mockOutletId,
          type: 'RECEIPT',
          isDefault: true,
        },
        { isDefault: false },
      );
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PRINTER_CREATED' }),
      );
      expect(result.name).toBe('Bluetooth Cashier');
    });
  });

  describe('update', () => {
    it('updates printer and unsets existing default if isDefault is true', async () => {
      printerRepo.findOne.mockResolvedValue({
        id: 'p-1',
        outletId: mockOutletId,
        type: 'RECEIPT',
        connectionType: 'BLUETOOTH',
      });
      printerRepo.findOneOrFail.mockResolvedValue({
        id: 'p-1',
        name: 'Updated Printer',
        isDefault: true,
      });

      const result = await service.update(
        mockTenantId,
        'p-1',
        { name: 'Updated Printer', isDefault: true },
        mockUserId,
      );

      expect(printerRepo.update).toHaveBeenCalledWith(
        {
          tenantId: mockTenantId,
          outletId: mockOutletId,
          type: 'RECEIPT',
          isDefault: true,
        },
        { isDefault: false },
      );
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PRINTER_UPDATED' }),
      );
      expect(result.name).toBe('Updated Printer');
    });
  });

  describe('delete', () => {
    it('deletes printer and logs audit', async () => {
      printerRepo.findOne.mockResolvedValue({
        id: 'p-1',
        name: 'To Delete',
        type: 'KITCHEN',
        outletId: mockOutletId,
      });

      const result = await service.delete(mockTenantId, 'p-1', mockUserId);
      expect(printerRepo.delete).toHaveBeenCalledWith({
        id: 'p-1',
        tenantId: mockTenantId,
      });
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PRINTER_DELETED' }),
      );
      expect(result.success).toBe(true);
    });
  });

  describe('printOrder', () => {
    it('throws NotFoundException if order does not exist', async () => {
      orderRepo.findOne.mockResolvedValue(null);

      await expect(
        service.printOrder(mockTenantId, 'bad-order', {}, mockUserId),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException if printing RECEIPT for non-COMPLETED order', async () => {
      orderRepo.findOne.mockResolvedValue({
        id: 'order-1',
        status: 'PENDING',
        outletId: mockOutletId,
      });

      await expect(
        service.printOrder(
          mockTenantId,
          'order-1',
          { type: 'RECEIPT' },
          mockUserId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException if no active printer configured', async () => {
      orderRepo.findOne.mockResolvedValue({
        id: 'order-1',
        status: 'COMPLETED',
        outletId: mockOutletId,
      });
      printerRepo.findOne.mockResolvedValue(null);

      await expect(
        service.printOrder(mockTenantId, 'order-1', {}, mockUserId),
      ).rejects.toThrow(NotFoundException);
    });

    it('returns READY_TO_PRINT and Base64 payload for BLUETOOTH printer', async () => {
      const mockOrder = {
        id: 'order-1',
        orderNumber: 'ORD-001',
        status: 'COMPLETED',
        outletId: mockOutletId,
      };
      orderRepo.findOne.mockResolvedValue(mockOrder);

      const mockPrinter = {
        id: 'p-bt',
        name: 'Kasir BT',
        type: 'RECEIPT',
        connectionType: 'BLUETOOTH',
        paperSize: '58mm',
        isDefault: true,
      };
      printerRepo.findOne.mockResolvedValue(mockPrinter);
      paymentRepo.find.mockResolvedValue([]);

      const result = await service.printOrder(
        mockTenantId,
        'order-1',
        { type: 'RECEIPT' },
        mockUserId,
        'Kasir Budi',
      );

      expect(escposBuilder.buildReceipt).toHaveBeenCalledWith(
        expect.objectContaining({
          cashierName: 'Kasir Budi',
          paperSize: '58mm',
        }),
      );
      expect(result.status).toBe('READY_TO_PRINT');
      expect(result.connectionType).toBe('BLUETOOTH');
      expect(result.escposPayload).toBeDefined();
      expect(result.rawText).toBe('Receipt content');
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'ORDER_PRINTED' }),
      );
    });

    it('sends data via NetworkPrinterDriver for NETWORK printer and returns SENT', async () => {
      const mockOrder = {
        id: 'order-2',
        orderNumber: 'ORD-002',
        status: 'COMPLETED',
        outletId: mockOutletId,
      };
      orderRepo.findOne.mockResolvedValue(mockOrder);

      const mockPrinter = {
        id: 'p-lan',
        name: 'Kitchen LAN',
        type: 'KITCHEN',
        connectionType: 'NETWORK',
        paperSize: '80mm',
        ipAddress: '192.168.1.150',
        port: 9100,
        isDefault: true,
      };
      printerRepo.findOne.mockResolvedValue(mockPrinter);
      networkDriver.send.mockResolvedValue(undefined);

      const result = await service.printOrder(
        mockTenantId,
        'order-2',
        { type: 'KITCHEN' },
        mockUserId,
      );

      expect(escposBuilder.buildKitchenTicket).toHaveBeenCalledWith(
        expect.objectContaining({ paperSize: '80mm' }),
      );
      expect(networkDriver.send).toHaveBeenCalledWith(
        expect.objectContaining({
          ipAddress: '192.168.1.150',
          port: 9100,
        }),
      );
      expect(result.status).toBe('SENT');
      expect(result.connectionType).toBe('NETWORK');
    });

    it('throws BadGatewayException when network printer communication fails', async () => {
      const mockOrder = {
        id: 'order-3',
        orderNumber: 'ORD-003',
        status: 'COMPLETED',
        outletId: mockOutletId,
      };
      orderRepo.findOne.mockResolvedValue(mockOrder);

      const mockPrinter = {
        id: 'p-lan',
        name: 'Kitchen LAN',
        type: 'KITCHEN',
        connectionType: 'NETWORK',
        paperSize: '80mm',
        ipAddress: '192.168.1.150',
        port: 9100,
      };
      printerRepo.findOne.mockResolvedValue(mockPrinter);
      networkDriver.send.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(
        service.printOrder(
          mockTenantId,
          'order-3',
          { type: 'KITCHEN' },
          mockUserId,
        ),
      ).rejects.toThrow(BadGatewayException);
    });
  });
});
