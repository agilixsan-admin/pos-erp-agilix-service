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
import { Recipe } from '../../recipe/entities/recipe.entity';
import { InventoryStock } from '../../inventory/entities/inventory-stock.entity';
import { InventoryMovement } from '../../inventory/entities/inventory-movement.entity';
import { AuditService } from '../../audit/audit.service';
import { SettingsService } from '../../settings/services/settings.service';
import { DiscountService } from '../../settings/services/discount.service';
import { PackagingService } from '../../packaging/services/packaging.service';

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

  const mockSettingsService = {
    getSettings: jest.fn().mockResolvedValue({
      taxEnabled: false,
      taxRate: 0,
      taxName: 'Tax',
      discountEnabled: false,
      discountType: 'PERCENTAGE',
      discountValue: 0,
    }),
  };

  const mockPackagingService = {
    findApplicableForOrder: jest.fn().mockResolvedValue([]),
  };

  const mockDiscountService = {
    findById: jest.fn(),
    isDiscountActive: jest.fn().mockReturnValue({ isValid: true }),
    calculateDiscount: jest.fn().mockReturnValue(5000),
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
        {
          provide: SettingsService,
          useValue: mockSettingsService,
        },
        {
          provide: DiscountService,
          useValue: mockDiscountService,
        },
        {
          provide: PackagingService,
          useValue: mockPackagingService,
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

      const defaultRepo = {
        find: jest.fn().mockResolvedValue([]),
        findOne: jest.fn().mockResolvedValue(null),
        create: jest.fn((x: any) => x),
        save: jest.fn((x: any) => Promise.resolve(x)),
      };

      mockDataSource.transaction.mockImplementation(
        (callback: (m: unknown) => Promise<unknown>) => {
          return callback({
            getRepository: (entityClass: unknown) => {
              if (entityClass === Order) return managerOrderRepo;
              if (entityClass === OrderItem) return managerItemRepo;
              if (entityClass === Table) return managerTableRepo;
              if (entityClass === AuditService) return managerAuditRepo;
              return defaultRepo;
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

    it('deducts raw material recipe stocks and records SALE movements when sending order to station', async () => {
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
          id: 'ord-stock-1',
          orderNumber: 'ORD-STOCK-1',
        })),
        save: jest.fn((o: Record<string, unknown>) => Promise.resolve(o)),
        findOne: jest.fn().mockResolvedValue({
          id: 'ord-stock-1',
          orderNumber: 'ORD-STOCK-1',
          totalAmount: 50000,
        }),
      };
      const managerItemRepo = {
        create: jest.fn((i: Record<string, unknown>) => ({
          ...i,
          id: 'item-1',
        })),
        save: jest.fn((items: any[]) => Promise.resolve(items)),
      };
      const managerRecipeRepo = {
        find: jest.fn().mockResolvedValue([
          {
            inventoryItemId: 'inv-coffee-beans',
            quantity: 18,
          },
        ]),
      };
      const managerStockRepo = {
        findOne: jest.fn().mockResolvedValue({
          inventoryItemId: 'inv-coffee-beans',
          quantity: 1000,
        }),
        save: jest.fn((s: Record<string, unknown>) => Promise.resolve(s)),
      };
      const managerMovementRepo = {
        create: jest.fn((m: Record<string, unknown>) => ({
          ...m,
          id: 'mov-1',
        })),
        save: jest.fn((m: Record<string, unknown>) => Promise.resolve(m)),
      };

      mockDataSource.transaction.mockImplementation(
        (callback: (m: unknown) => Promise<unknown>) => {
          return callback({
            getRepository: (entityClass: unknown) => {
              if (entityClass === Order) return managerOrderRepo;
              if (entityClass === OrderItem) return managerItemRepo;
              if (entityClass === Recipe) return managerRecipeRepo;
              if (entityClass === InventoryStock) return managerStockRepo;
              if (entityClass === InventoryMovement) return managerMovementRepo;
              return {
                find: jest.fn().mockResolvedValue([]),
                findOne: jest.fn().mockResolvedValue(null),
                create: jest.fn((x: any) => x),
                save: jest.fn((x: any) => Promise.resolve(x)),
              };
            },
          });
        },
      );

      await service.create('tenant-1', 'user-1', 'outlet-1', {
        items: [{ variantId: 'var-1', quantity: 2 }],
      });

      // Quantity 2 * 18g = 36g deducted upon creation (when sent to station)
      expect(managerStockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          quantity: 1000 - 36,
        }),
      );
      expect(managerMovementRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          movementType: 'SALE',
          quantity: 36,
          referenceType: 'ORDER',
          notes: expect.stringContaining('Sent to station via Order'),
        }),
      );
    });

    it('applies tax and discount automatically according to operational settings', async () => {
      mockSettingsService.getSettings.mockResolvedValueOnce({
        taxEnabled: true,
        taxRate: 10,
        taxName: 'PB1',
        discountEnabled: true,
        discountType: 'PERCENTAGE',
        discountValue: 10,
      });

      mockOutletRepo.findOne.mockResolvedValue({
        id: 'outlet-1',
        tenantId: 'tenant-1',
      });
      mockVariantRepo.find.mockResolvedValue([
        {
          id: 'var-1',
          productId: 'prod-1',
          name: 'Regular',
          price: 100000,
          tenantId: 'tenant-1',
          product: { name: 'Americano' },
        },
      ]);

      let createdOrder: Record<string, unknown> | null = null;
      const managerOrderRepo = {
        create: jest.fn((o: Record<string, unknown>) => {
          createdOrder = o;
          return { ...o, id: 'ord-tax' };
        }),
        save: jest.fn((o: Record<string, unknown>) => Promise.resolve(o)),
        findOne: jest.fn().mockResolvedValue({ id: 'ord-tax' }),
      };
      const managerItemRepo = {
        create: jest.fn((i: Record<string, unknown>) => i),
        save: jest.fn().mockResolvedValue([]),
      };

      mockDataSource.transaction.mockImplementation(
        (callback: (m: unknown) => Promise<unknown>) => {
          return callback({
            getRepository: (entityClass: unknown) => {
              if (entityClass === Order) return managerOrderRepo;
              if (entityClass === OrderItem) return managerItemRepo;
              return {
                find: jest.fn().mockResolvedValue([]),
                findOne: jest.fn().mockResolvedValue(null),
                create: jest.fn((x: any) => x),
                save: jest.fn((x: any) => Promise.resolve(x)),
              };
            },
          });
        },
      );

      await service.create('tenant-1', 'user-1', 'outlet-1', {
        items: [{ variantId: 'var-1', quantity: 1 }],
      });

      expect(createdOrder).not.toBeNull();
      expect(createdOrder?.['subtotal']).toBe(100000);
      expect(createdOrder?.['discountAmount']).toBe(10000);
      expect(createdOrder?.['taxAmount']).toBe(9000);
      expect(createdOrder?.['totalAmount']).toBe(99000);
    });

    it('applies promo discountId successfully and calculates total', async () => {
      mockSettingsService.getSettings.mockResolvedValueOnce({
        taxEnabled: false,
        discountEnabled: false,
      });

      mockOutletRepo.findOne.mockResolvedValue({
        id: 'outlet-1',
        tenantId: 'tenant-1',
      });
      mockVariantRepo.find.mockResolvedValue([
        {
          id: 'var-1',
          productId: 'prod-1',
          name: 'Regular',
          price: 50000,
          tenantId: 'tenant-1',
          product: { name: 'Latte' },
        },
      ]);

      mockDiscountService.findById.mockResolvedValueOnce({
        id: 'disc-promo-1',
        name: 'Promo 10rb',
      });
      mockDiscountService.isDiscountActive.mockReturnValueOnce({
        isValid: true,
      });
      mockDiscountService.calculateDiscount.mockReturnValueOnce(10000);

      let createdOrder: Record<string, unknown> | null = null;
      mockDataSource.transaction.mockImplementationOnce(
        (callback: (m: unknown) => Promise<unknown>) => {
          return callback({
            getRepository: (entity: unknown) => {
              if (entity === Order) {
                return {
                  create: jest.fn((o: Record<string, unknown>) => {
                    createdOrder = o;
                    return { ...o, id: 'ord-disc' };
                  }),
                  save: jest.fn((o: Record<string, unknown>) =>
                    Promise.resolve(o),
                  ),
                  findOne: jest.fn().mockResolvedValue({ id: 'ord-disc' }),
                };
              }
              if (entity === OrderItem) {
                return {
                  create: jest.fn((i: Record<string, unknown>) => i),
                  save: jest.fn().mockResolvedValue([]),
                };
              }
              return {
                find: jest.fn().mockResolvedValue([]),
                findOne: jest.fn().mockResolvedValue(null),
                create: jest.fn((x: any) => x),
                save: jest.fn((x: any) => Promise.resolve(x)),
              };
            },
          });
        },
      );

      await service.create('tenant-1', 'user-1', 'outlet-1', {
        discountId: 'disc-promo-1',
        items: [{ variantId: 'var-1', quantity: 1 }],
      });

      expect(createdOrder).not.toBeNull();
      expect(createdOrder?.['subtotal']).toBe(50000);
      expect(createdOrder?.['discountId']).toBe('disc-promo-1');
      expect(createdOrder?.['discountAmount']).toBe(10000);
      expect(createdOrder?.['totalAmount']).toBe(40000);
    });

    it('calculates INCLUSIVE tax correctly without adding on top of total amount', async () => {
      mockSettingsService.getSettings.mockResolvedValueOnce({
        taxEnabled: true,
        discountEnabled: false,
        defaultGlobalTax: {
          id: 'tax-inc',
          name: 'PPN 11%',
          rate: 11,
          type: 'INCLUSIVE',
        },
      });

      mockOutletRepo.findOne.mockResolvedValue({
        id: 'outlet-1',
        tenantId: 'tenant-1',
      });
      mockVariantRepo.find.mockResolvedValue([
        {
          id: 'var-1',
          productId: 'prod-1',
          name: 'Regular',
          price: 111000,
          tenantId: 'tenant-1',
          product: { name: 'Americano' },
        },
      ]);

      let createdOrder: Record<string, unknown> | null = null;
      const managerOrderRepo = {
        create: jest.fn((o: Record<string, unknown>) => {
          createdOrder = o;
          return { ...o, id: 'ord-inc-tax' };
        }),
        save: jest.fn((o: Record<string, unknown>) => Promise.resolve(o)),
        findOne: jest.fn().mockResolvedValue({ id: 'ord-inc-tax' }),
      };
      const managerItemRepo = {
        create: jest.fn((i: Record<string, unknown>) => i),
        save: jest.fn().mockResolvedValue([]),
      };

      mockDataSource.transaction.mockImplementation(
        (callback: (m: unknown) => Promise<unknown>) => {
          return callback({
            getRepository: (entityClass: unknown) => {
              if (entityClass === Order) return managerOrderRepo;
              if (entityClass === OrderItem) return managerItemRepo;
              return {
                find: jest.fn().mockResolvedValue([]),
                findOne: jest.fn().mockResolvedValue(null),
                create: jest.fn((x: any) => x),
                save: jest.fn((x: any) => Promise.resolve(x)),
              };
            },
          });
        },
      );

      await service.create('tenant-1', 'user-1', 'outlet-1', {
        items: [{ variantId: 'var-1', quantity: 1 }],
      });

      expect(createdOrder).not.toBeNull();
      expect(createdOrder?.['subtotal']).toBe(111000);
      // Tax is included inside: 111000 - (111000 / 1.11) = 11000
      expect(createdOrder?.['taxAmount']).toBe(11000);
      // Total amount remains 111000 because tax is inclusive
      expect(createdOrder?.['totalAmount']).toBe(111000);
    });

    it('creates TAKE_AWAY order with automatically calculated packaging fee', async () => {
      mockOutletRepo.findOne.mockResolvedValue({
        id: 'outlet-1',
        tenantId: 'tenant-1',
      });
      mockVariantRepo.find.mockResolvedValue([
        {
          id: 'var-1',
          productId: 'prod-1',
          name: 'Regular',
          price: 20000,
          tenantId: 'tenant-1',
          product: { name: 'Latte' },
        },
      ]);
      mockPackagingService.findApplicableForOrder.mockResolvedValue([
        { id: 'pkg-1', name: 'Paper Cup', extraPrice: 2000 },
        { id: 'pkg-2', name: 'Plastic Bag', extraPrice: 1000 },
      ]);

      let createdOrder: Record<string, unknown> | null = null;
      const managerOrderRepo = {
        create: jest.fn((o: Record<string, unknown>) => {
          createdOrder = o;
          return { ...o, id: 'ord-takeaway' };
        }),
        save: jest.fn((o: Record<string, unknown>) => Promise.resolve(o)),
        findOne: jest.fn().mockResolvedValue({ id: 'ord-takeaway' }),
      };
      const managerItemRepo = {
        create: jest.fn((i: Record<string, unknown>) => i),
        save: jest.fn().mockResolvedValue([]),
      };

      mockDataSource.transaction.mockImplementation(
        (callback: (m: unknown) => Promise<unknown>) => {
          return callback({
            getRepository: (entityClass: unknown) => {
              if (entityClass === Order) return managerOrderRepo;
              if (entityClass === OrderItem) return managerItemRepo;
              return {
                find: jest.fn().mockResolvedValue([]),
                findOne: jest.fn().mockResolvedValue(null),
                create: jest.fn((x: any) => x),
                save: jest.fn((x: any) => Promise.resolve(x)),
              };
            },
          });
        },
      );

      await service.create('tenant-1', 'user-1', 'outlet-1', {
        orderType: 'TAKE_AWAY',
        items: [{ variantId: 'var-1', quantity: 1 }],
      });

      expect(createdOrder).not.toBeNull();
      expect(createdOrder?.['subtotal']).toBe(20000);
      expect(createdOrder?.['packagingFee']).toBe(3000);
      expect(createdOrder?.['totalAmount']).toBe(23000);
      expect(mockPackagingService.findApplicableForOrder).toHaveBeenCalledWith(
        'tenant-1',
        'outlet-1',
        'TAKE_AWAY',
      );
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

      mockDataSource.transaction.mockImplementation(
        (callback: (m: unknown) => Promise<unknown>) => {
          return callback({
            getRepository: (entityClass: unknown) => {
              if (entityClass === Order) return managerOrderRepo;
              if (entityClass === OrderItem) return managerItemRepo;
              if (entityClass === Table) return managerTableRepo;
              return {
                find: jest.fn().mockResolvedValue([]),
                findOne: jest.fn().mockResolvedValue(null),
                create: jest.fn((x: any) => x),
                save: jest.fn((x: any) => Promise.resolve(x)),
              };
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
          tableId: 'tbl-non-existent',
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
      mockVariantRepo.find.mockResolvedValue([]);

      await expect(
        service.create('tenant-1', 'user-1', 'outlet-1', {
          items: [{ variantId: 'var-invalid', quantity: 1 }],
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findById', () => {
    it('returns order with relations when found for tenant', async () => {
      const order = { id: 'ord-1', tenantId: 'tenant-1' };
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

      await expect(service.findById('tenant-1', 'ord-invalid')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('void', () => {
    it('voids specific menu item, reclassifies movement to WASTE without double deduction, recalculates order, and releases table if all items voided', async () => {
      const item1 = {
        id: 'item-1',
        orderId: 'ord-1',
        variantId: 'var-1',
        productName: 'Americano',
        variantName: 'Regular',
        unitPrice: 25000,
        quantity: 1,
        subtotal: 25000,
        status: 'ACTIVE',
      };
      const order = {
        id: 'ord-1',
        tenantId: 'tenant-1',
        outletId: 'outlet-1',
        orderNumber: 'ORD-123',
        status: 'PENDING',
        orderType: 'DINE_IN',
        tableId: 'tbl-1',
        subtotal: 25000,
        totalAmount: 25000,
        items: [item1],
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
      const managerItemRepo = {
        save: jest.fn().mockResolvedValue(item1),
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
      const existingMovement = {
        id: 'mov-1',
        tenantId: 'tenant-1',
        outletId: 'outlet-1',
        referenceType: 'ORDER',
        referenceId: 'ord-1',
        movementType: 'SALE',
        quantity: 18,
        metadata: { orderItemId: 'item-1', variantId: 'var-1' },
      };
      const managerMovementRepo = {
        find: jest.fn().mockResolvedValue([existingMovement]),
        save: jest.fn((m: Record<string, unknown>) => Promise.resolve(m)),
      };

      mockDataSource.transaction.mockImplementation(
        (callback: (m: unknown) => Promise<unknown>) => {
          return callback({
            getRepository: (entityClass: unknown) => {
              if (entityClass === Order) return managerOrderRepo;
              if (entityClass === OrderItem) return managerItemRepo;
              if (entityClass === Void) return managerVoidRepo;
              if (entityClass === Table) return managerTableRepo;
              if (entityClass === InventoryMovement) return managerMovementRepo;
              return {
                find: jest.fn().mockResolvedValue([]),
                findOne: jest.fn().mockResolvedValue(null),
                create: jest.fn((x: any) => x),
                save: jest.fn((x: any) => Promise.resolve(x)),
              };
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
          orderItemId: 'item-1',
          reason: 'Customer cancelled drink',
        },
      );

      expect(result.voidedItem.status).toBe('VOID');
      expect(result.order.status).toBe('VOID');
      expect(result.order.totalAmount).toBe(0);
      expect(managerMovementRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          movementType: 'WASTE',
          referenceType: 'VOID',
          notes: expect.stringContaining('Void menu item: Americano'),
        }),
      );
      expect(managerTableRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'tbl-1',
          status: 'AVAILABLE',
        }),
      );
    });

    it('rejects void if order is already completed', async () => {
      const order = {
        id: 'ord-1',
        tenantId: 'tenant-1',
        status: 'COMPLETED',
        items: [{ id: 'item-1', status: 'ACTIVE' }],
      };
      const qb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(order),
      } as unknown as SelectQueryBuilder<Order>;
      mockOrderRepo.createQueryBuilder.mockReturnValue(qb);

      await expect(
        service.void('tenant-1', 'user-1', 'outlet-1', 'ord-1', {
          orderItemId: 'item-1',
          reason: 'Cancel',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects void if item is already voided', async () => {
      const order = {
        id: 'ord-1',
        tenantId: 'tenant-1',
        status: 'PENDING',
        items: [{ id: 'item-1', status: 'VOID' }],
      };
      const qb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(order),
      } as unknown as SelectQueryBuilder<Order>;
      mockOrderRepo.createQueryBuilder.mockReturnValue(qb);

      await expect(
        service.void('tenant-1', 'user-1', 'outlet-1', 'ord-1', {
          orderItemId: 'item-1',
          reason: 'Cancel',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('addItems', () => {
    it('successfully adds new items to PENDING order, deducts stock, recalculates totals, and logs audit', async () => {
      const existingOrder = {
        id: 'ord-100',
        orderNumber: 'ORD-100',
        tenantId: 'tenant-1',
        outletId: 'outlet-1',
        status: 'PENDING',
        subtotal: 50000,
        discountAmount: 0,
        taxAmount: 0,
        packagingFee: 0,
        totalAmount: 50000,
        items: [
          {
            id: 'item-1',
            variantId: 'var-1',
            productName: 'Latte',
            variantName: 'Regular',
            quantity: 1,
            unitPrice: 50000,
            subtotal: 50000,
            status: 'ACTIVE',
          },
        ],
      };

      const qb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(existingOrder),
      } as unknown as SelectQueryBuilder<Order>;
      mockOrderRepo.createQueryBuilder.mockReturnValue(qb);

      mockVariantRepo.find.mockResolvedValueOnce([
        {
          id: 'var-2',
          productId: 'prod-2',
          name: 'Croissant',
          price: 25000,
          tenantId: 'tenant-1',
          product: { name: 'Butter Croissant' },
        },
      ]);

      const mockStock = {
        id: 'stock-flour',
        tenantId: 'tenant-1',
        outletId: 'outlet-1',
        inventoryItemId: 'item-flour',
        quantity: 1000,
      };

      let savedItems: unknown[] = [];
      let savedOrder: Record<string, unknown> | null = null;
      const savedMovements: unknown[] = [];

      mockDataSource.transaction.mockImplementationOnce(
        (callback: (m: unknown) => Promise<unknown>) => {
          return callback({
            getRepository: (entity: unknown) => {
              if (entity === OrderItem) {
                return {
                  create: jest.fn((items: unknown[]) => items),
                  save: jest.fn((items: unknown[]) => {
                    savedItems = items;
                    return Promise.resolve(items);
                  }),
                };
              }
              if (entity === Recipe) {
                return {
                  find: jest.fn().mockResolvedValue([
                    {
                      id: 'recipe-1',
                      variantId: 'var-2',
                      inventoryItemId: 'item-flour',
                      quantity: 100,
                    },
                  ]),
                };
              }
              if (entity === InventoryStock) {
                return {
                  findOne: jest.fn().mockResolvedValue(mockStock),
                  save: jest.fn((stk: unknown) => Promise.resolve(stk)),
                };
              }
              if (entity === InventoryMovement) {
                return {
                  create: jest.fn((mv: unknown) => mv),
                  save: jest.fn((mv: unknown) => {
                    savedMovements.push(mv);
                    return Promise.resolve(mv);
                  }),
                };
              }
              if (entity === Order) {
                return {
                  save: jest.fn((o: Record<string, unknown>) => {
                    savedOrder = o;
                    return Promise.resolve(o);
                  }),
                  findOne: jest.fn().mockResolvedValue({
                    ...existingOrder,
                    subtotal: 75000,
                    totalAmount: 75000,
                    items: [
                      ...existingOrder.items,
                      {
                        id: 'item-2',
                        variantId: 'var-2',
                        productName: 'Butter Croissant',
                        variantName: 'Croissant',
                        quantity: 1,
                        unitPrice: 25000,
                        subtotal: 25000,
                        status: 'ACTIVE',
                      },
                    ],
                  }),
                };
              }
              return {
                find: jest.fn().mockResolvedValue([]),
                findOne: jest.fn().mockResolvedValue(null),
                create: jest.fn((x: any) => x),
                save: jest.fn((x: any) => Promise.resolve(x)),
              };
            },
          });
        },
      );

      const result = await service.addItems('tenant-1', 'user-1', 'ord-100', {
        items: [{ variantId: 'var-2', quantity: 1, notes: 'Warm' }],
      });

      expect(savedItems).toHaveLength(1);
      expect(mockStock.quantity).toBe(900); // 1000 - 100
      expect(savedMovements).toHaveLength(1);
      expect(savedMovements[0]).toEqual(
        expect.objectContaining({
          movementType: 'SALE',
          referenceType: 'ORDER',
          quantity: 100,
        }),
      );
      expect(savedOrder).not.toBeNull();
      expect(savedOrder?.['subtotal']).toBe(75000);
      expect(savedOrder?.['totalAmount']).toBe(75000);
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'ORDER_ITEMS_ADDED',
          metadata: expect.objectContaining({
            orderId: 'ord-100',
          }),
        }),
        expect.anything(),
      );
      expect(result.items).toHaveLength(2);
    });

    it('throws NotFoundException if order does not exist', async () => {
      const qb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      } as unknown as SelectQueryBuilder<Order>;
      mockOrderRepo.createQueryBuilder.mockReturnValue(qb);

      await expect(
        service.addItems('tenant-1', 'user-1', 'ord-999', {
          items: [{ variantId: 'var-1', quantity: 1 }],
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException if order is not PENDING (e.g. COMPLETED)', async () => {
      const qb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({
          id: 'ord-comp',
          status: 'COMPLETED',
          tenantId: 'tenant-1',
          items: [],
        }),
      } as unknown as SelectQueryBuilder<Order>;
      mockOrderRepo.createQueryBuilder.mockReturnValue(qb);

      await expect(
        service.addItems('tenant-1', 'user-1', 'ord-comp', {
          items: [{ variantId: 'var-1', quantity: 1 }],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException if variant is not found', async () => {
      const qb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({
          id: 'ord-100',
          status: 'PENDING',
          tenantId: 'tenant-1',
          items: [],
        }),
      } as unknown as SelectQueryBuilder<Order>;
      mockOrderRepo.createQueryBuilder.mockReturnValue(qb);

      mockVariantRepo.find.mockResolvedValueOnce([]); // No variant found

      await expect(
        service.addItems('tenant-1', 'user-1', 'ord-100', {
          items: [{ variantId: 'non-existent-var', quantity: 1 }],
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
