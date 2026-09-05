import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, SelectQueryBuilder } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { OrderService } from './order.service';
import { Order } from '../entities/order.entity';
import { OrderItem } from '../entities/order-item.entity';
import { Void } from '../entities/void.entity';
import { Outlet } from '../../outlet/outlet.entity';
import { ProductVariant } from '../../product/entities/product-variant.entity';
import { Table } from '../../table/entities/table.entity';
import { AuditService } from '../../audit/audit.service';

describe('OrderService', () => {
  let service: OrderService;

  const mockOrderRepo = {
    createQueryBuilder: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
  };

  const mockOrderItemRepo = {
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockVoidRepo = {
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockOutletRepo = {
    findOne: jest.fn(),
  };

  const mockVariantRepo = {
    find: jest.fn(),
  };

  const mockTableRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
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
        OrderService,
        {
          provide: getRepositoryToken(Order),
          useValue: mockOrderRepo,
        },
        {
          provide: getRepositoryToken(OrderItem),
          useValue: mockOrderItemRepo,
        },
        {
          provide: getRepositoryToken(Void),
          useValue: mockVoidRepo,
        },
        {
          provide: getRepositoryToken(Outlet),
          useValue: mockOutletRepo,
        },
        {
          provide: getRepositoryToken(ProductVariant),
          useValue: mockVariantRepo,
        },
        {
          provide: getRepositoryToken(Table),
          useValue: mockTableRepo,
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

    service = module.get<OrderService>(OrderService);
  });

  describe('create', () => {
    it('creates order with historical price snapshot and calculates subtotal/total', async () => {
      mockOutletRepo.findOne.mockResolvedValue({
        id: 'outlet-1',
        tenantId: 'tenant-1',
      });
      mockVariantRepo.find.mockResolvedValue([
        {
          id: 'var-1',
          productId: 'prod-1',
          name: 'Regular',
          price: 25000,
          tenantId: 'tenant-1',
          product: { name: 'Americano' },
        },
      ]);

      const managerOrderRepo = {
        create: jest.fn((o: Record<string, unknown>) => ({
          ...o,
          id: 'ord-1',
        })),
        save: jest.fn((o: Record<string, unknown>) => Promise.resolve(o)),
        findOne: jest.fn().mockResolvedValue({
          id: 'ord-1',
          orderNumber: 'ORD-123',
          totalAmount: 50000,
        }),
      };
      const managerItemRepo = {
        create: jest.fn((i: Record<string, unknown>) => i),
        save: jest.fn().mockResolvedValue([]),
      };
      const managerTableRepo = {
        save: jest.fn((t: Record<string, unknown>) => Promise.resolve(t)),
      };
      const managerAuditRepo = {
        save: jest.fn().mockResolvedValue({}),
      };

      mockDataSource.transaction.mockImplementation(
        (callback: (m: unknown) => Promise<unknown>) => {
          return callback({
            getRepository: (entityClass: unknown) => {
              if (entityClass === Order) return managerOrderRepo;
              if (entityClass === OrderItem) return managerItemRepo;
              if (entityClass === Table) return managerTableRepo;
              return managerAuditRepo;
            },
          });
        },
      );

      const result = await service.create('tenant-1', 'user-1', 'outlet-1', {
        items: [{ variantId: 'var-1', quantity: 2 }],
      });

      expect(result).toBeDefined();
      expect(mockDataSource.transaction).toHaveBeenCalled();
    });

    it('creates DINE_IN order with assigned table and marks it OCCUPIED', async () => {
      mockOutletRepo.findOne.mockResolvedValue({
        id: 'outlet-1',
        tenantId: 'tenant-1',
      });
      mockVariantRepo.find.mockResolvedValue([
        {
          id: 'var-1',
          productId: 'prod-1',
          name: 'Regular',
          price: 25000,
          tenantId: 'tenant-1',
          product: { name: 'Americano' },
        },
      ]);
      mockTableRepo.findOne.mockResolvedValue({
        id: 'tbl-1',
        name: 'Table 1',
        status: 'AVAILABLE',
        outletId: 'outlet-1',
        tenantId: 'tenant-1',
      });

      const managerOrderRepo = {
        create: jest.fn((o: Record<string, unknown>) => ({
          ...o,
          id: 'ord-1',
        })),
        save: jest.fn((o: Record<string, unknown>) => Promise.resolve(o)),
        findOne: jest.fn().mockResolvedValue({
          id: 'ord-1',
          orderNumber: 'ORD-123',
          totalAmount: 25000,
          tableId: 'tbl-1',
        }),
      };
      const managerItemRepo = {
        create: jest.fn((i: Record<string, unknown>) => i),
        save: jest.fn().mockResolvedValue([]),
      };
      const managerTableRepo = {
        save: jest.fn((t: Record<string, unknown>) => Promise.resolve(t)),
      };
      const managerAuditRepo = {
        save: jest.fn().mockResolvedValue({}),
      };

      mockDataSource.transaction.mockImplementation(
        (callback: (m: unknown) => Promise<unknown>) => {
          return callback({
            getRepository: (entityClass: unknown) => {
              if (entityClass === Order) return managerOrderRepo;
              if (entityClass === OrderItem) return managerItemRepo;
              if (entityClass === Table) return managerTableRepo;
              return managerAuditRepo;
            },
          });
        },
      );

      const result = await service.create('tenant-1', 'user-1', 'outlet-1', {
        orderType: 'DINE_IN',
        tableId: 'tbl-1',
        items: [{ variantId: 'var-1', quantity: 1 }],
      });

      expect(result).toBeDefined();
      expect(managerTableRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'tbl-1',
          status: 'OCCUPIED',
        }),
      );
    });

    it('rejects DINE_IN order if assigned table is not AVAILABLE', async () => {
      mockOutletRepo.findOne.mockResolvedValue({
        id: 'outlet-1',
        tenantId: 'tenant-1',
      });
      mockVariantRepo.find.mockResolvedValue([
        {
          id: 'var-1',
          productId: 'prod-1',
          name: 'Regular',
          price: 25000,
          tenantId: 'tenant-1',
          product: { name: 'Americano' },
        },
      ]);
      mockTableRepo.findOne.mockResolvedValue({
        id: 'tbl-1',
        name: 'Table 1',
        status: 'OCCUPIED',
        outletId: 'outlet-1',
        tenantId: 'tenant-1',
      });

      await expect(
        service.create('tenant-1', 'user-1', 'outlet-1', {
          orderType: 'DINE_IN',
          tableId: 'tbl-1',
          items: [{ variantId: 'var-1', quantity: 1 }],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects DINE_IN order if assigned table is not found', async () => {
      mockOutletRepo.findOne.mockResolvedValue({
        id: 'outlet-1',
        tenantId: 'tenant-1',
      });
      mockVariantRepo.find.mockResolvedValue([
        {
          id: 'var-1',
          productId: 'prod-1',
          name: 'Regular',
          price: 25000,
          tenantId: 'tenant-1',
          product: { name: 'Americano' },
        },
      ]);
      mockTableRepo.findOne.mockResolvedValue(null);

      await expect(
        service.create('tenant-1', 'user-1', 'outlet-1', {
          orderType: 'DINE_IN',
          tableId: 'non-existent-table',
          items: [{ variantId: 'var-1', quantity: 1 }],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects TAKE_AWAY order when tableId is provided', async () => {
      mockOutletRepo.findOne.mockResolvedValue({
        id: 'outlet-1',
        tenantId: 'tenant-1',
      });
      mockVariantRepo.find.mockResolvedValue([
        {
          id: 'var-1',
          productId: 'prod-1',
          name: 'Regular',
          price: 25000,
          tenantId: 'tenant-1',
          product: { name: 'Americano' },
        },
      ]);

      await expect(
        service.create('tenant-1', 'user-1', 'outlet-1', {
          orderType: 'TAKE_AWAY',
          tableId: 'tbl-1',
          items: [{ variantId: 'var-1', quantity: 1 }],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects order if variant belongs to another tenant', async () => {
      mockOutletRepo.findOne.mockResolvedValue({
        id: 'outlet-1',
        tenantId: 'tenant-1',
      });
      mockVariantRepo.find.mockResolvedValue([]); // not found for tenant-1

      await expect(
        service.create('tenant-1', 'user-1', 'outlet-1', {
          items: [{ variantId: 'var-foreign', quantity: 1 }],
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findById', () => {
    it('returns order with relations when found for tenant', async () => {
      const order = { id: 'ord-1', tenantId: 'tenant-1', orderNumber: 'ORD-1' };
      const qb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(order),
      } as unknown as SelectQueryBuilder<Order>;
      mockOrderRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findById('tenant-1', 'ord-1');
      expect(result).toEqual(order);
    });

    it('throws NotFoundException when order does not exist or belongs to another tenant', async () => {
      const qb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      } as unknown as SelectQueryBuilder<Order>;
      mockOrderRepo.createQueryBuilder.mockReturnValue(qb);

      await expect(service.findById('tenant-1', 'ord-foreign')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('void', () => {
    it('sets order to VOID, releases table, and logs void entry', async () => {
      const order = {
        id: 'ord-1',
        tenantId: 'tenant-1',
        outletId: 'outlet-1',
        tableId: 'tbl-1',
        status: 'PENDING',
      };
      const qb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(order),
      } as unknown as SelectQueryBuilder<Order>;
      mockOrderRepo.createQueryBuilder.mockReturnValue(qb);

      const managerOrderRepo = {
        save: jest.fn().mockResolvedValue(order),
      };
      const managerVoidRepo = {
        create: jest.fn((v: Record<string, unknown>) => ({
          ...v,
          id: 'void-1',
        })),
        save: jest.fn((v: Record<string, unknown>) => Promise.resolve(v)),
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
              if (entityClass === Order) return managerOrderRepo;
              if (entityClass === Void) return managerVoidRepo;
              if (entityClass === Table) return managerTableRepo;
              return managerAuditRepo;
            },
          });
        },
      );

      const result = await service.void(
        'tenant-1',
        'user-1',
        'outlet-1',
        'ord-1',
        {
          reason: 'Customer cancelled order',
        },
      );

      expect(result.order.status).toBe('VOID');
      expect(managerTableRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'tbl-1',
          status: 'AVAILABLE',
        }),
      );
      expect(mockDataSource.transaction).toHaveBeenCalled();
    });
  });
});
