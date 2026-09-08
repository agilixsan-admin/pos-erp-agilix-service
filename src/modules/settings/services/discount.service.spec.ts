import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DiscountService } from './discount.service';
import { Discount } from '../entities/discount.entity';
import { Outlet } from '../../outlet/outlet.entity';
import { Product } from '../../product/entities/product.entity';
import { AuditService } from '../../audit/audit.service';

describe('DiscountService', () => {
  let service: DiscountService;
  let discountRepo: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    softDelete: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let outletRepo: {
    findOne: jest.Mock;
  };
  let productRepo: {
    find: jest.Mock;
    findOne: jest.Mock;
  };
  let auditService: {
    record: jest.Mock;
  };
  let dataSource: {
    transaction: jest.Mock;
  };

  const mockTenantId = 'tenant-uuid-1';
  const mockOutletId = 'outlet-uuid-1';
  const mockUserId = 'user-uuid-1';

  beforeEach(async () => {
    discountRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(
        (dto: Partial<Discount>) =>
          ({ ...dto, id: 'discount-uuid-1' }) as Discount,
      ),
      save: jest.fn((entity: Partial<Discount>) =>
        Promise.resolve({
          ...entity,
          id: entity.id || 'discount-uuid-1',
        } as Discount),
      ),
      softDelete: jest.fn().mockResolvedValue({ affected: 1 }),
      createQueryBuilder: jest.fn(),
    };

    outletRepo = {
      findOne: jest.fn(),
    };

    productRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
    };

    auditService = {
      record: jest.fn(),
    };

    dataSource = {
      transaction: jest.fn(
        <T>(
          cb: (manager: {
            getRepository: () => typeof discountRepo;
          }) => Promise<T>,
        ) => {
          const mockManager = {
            getRepository: () => discountRepo,
          };
          return cb(mockManager);
        },
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DiscountService,
        { provide: getRepositoryToken(Discount), useValue: discountRepo },
        { provide: getRepositoryToken(Outlet), useValue: outletRepo },
        { provide: getRepositoryToken(Product), useValue: productRepo },
        { provide: AuditService, useValue: auditService },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get<DiscountService>(DiscountService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('isDiscountActive', () => {
    it('returns true for ALWAYS_ACTIVE active discount', () => {
      const discount = {
        status: 'ACTIVE',
        validityType: 'ALWAYS_ACTIVE',
        minOrderAmount: 0,
      } as Discount;

      expect(service.isDiscountActive(discount).isValid).toBe(true);
    });

    it('returns false if discount is INACTIVE', () => {
      const discount = {
        status: 'INACTIVE',
        validityType: 'ALWAYS_ACTIVE',
      } as Discount;

      const check = service.isDiscountActive(discount);
      expect(check.isValid).toBe(false);
      expect(check.reason).toBe('INACTIVE');
    });

    it('returns false if order amount is less than minOrderAmount', () => {
      const discount = {
        status: 'ACTIVE',
        validityType: 'ALWAYS_ACTIVE',
        minOrderAmount: 50000,
      } as Discount;

      const check = service.isDiscountActive(discount, new Date(), 30000);
      expect(check.isValid).toBe(false);
      expect(check.reason).toBe('MIN_ORDER_AMOUNT_NOT_MET');
    });

    it('validates RECURRING_WEEKLY correctly', () => {
      const discount = {
        status: 'ACTIVE',
        validityType: 'RECURRING_WEEKLY',
        recurringDays: ['SATURDAY', 'SUNDAY'],
      } as Discount;

      // Saturday (2026-09-12 is Saturday)
      const saturday = new Date('2026-09-12T12:00:00Z');
      expect(service.isDiscountActive(discount, saturday).isValid).toBe(true);

      // Tuesday (2026-09-08 is Tuesday)
      const tuesday = new Date('2026-09-08T12:00:00Z');
      const checkTuesday = service.isDiscountActive(discount, tuesday);
      expect(checkTuesday.isValid).toBe(false);
      expect(checkTuesday.reason).toBe('NOT_ACTIVE_TODAY');
    });

    it('validates DATE_RANGE correctly', () => {
      const discount = {
        status: 'ACTIVE',
        validityType: 'DATE_RANGE',
        startDate: new Date('2026-01-01T00:00:00Z'),
        endDate: new Date('2026-01-31T23:59:59Z'),
      } as Discount;

      // Inside date range
      const inside = new Date('2026-01-15T12:00:00Z');
      expect(service.isDiscountActive(discount, inside).isValid).toBe(true);

      // After end date (EXPIRED)
      const after = new Date('2026-02-01T00:00:00Z');
      const checkAfter = service.isDiscountActive(discount, after);
      expect(checkAfter.isValid).toBe(false);
      expect(checkAfter.reason).toBe('EXPIRED');

      // Before start date
      const before = new Date('2025-12-31T23:59:59Z');
      const checkBefore = service.isDiscountActive(discount, before);
      expect(checkBefore.isValid).toBe(false);
      expect(checkBefore.reason).toBe('PROMO_NOT_STARTED');
    });
  });

  describe('calculateDiscount', () => {
    it('calculates PERCENTAGE discount for ALL_PRODUCTS', () => {
      const discount = {
        type: 'PERCENTAGE',
        value: 10,
        applicableScope: 'ALL_PRODUCTS',
      } as Discount;

      const items = [
        { productId: 'p1', unitPrice: 25000, quantity: 2 },
        { productId: 'p2', unitPrice: 50000, quantity: 1 },
      ];
      const subtotal = 100000;

      const result = service.calculateDiscount(discount, items, subtotal);
      expect(result).toBe(10000);
    });

    it('caps PERCENTAGE discount with maxDiscountAmount', () => {
      const discount = {
        type: 'PERCENTAGE',
        value: 50,
        maxDiscountAmount: 20000,
        applicableScope: 'ALL_PRODUCTS',
      } as Discount;

      const items = [{ productId: 'p1', unitPrice: 100000, quantity: 1 }];
      const subtotal = 100000;

      const result = service.calculateDiscount(discount, items, subtotal);
      expect(result).toBe(20000); // 50% is 50,000 but capped at 20,000
    });

    it('calculates FIXED discount for ALL_PRODUCTS', () => {
      const discount = {
        type: 'FIXED',
        value: 15000,
        applicableScope: 'ALL_PRODUCTS',
      } as Discount;

      const result = service.calculateDiscount(discount, [], 50000);
      expect(result).toBe(15000);
    });

    it('calculates discount only for SPECIFIC_PRODUCTS', () => {
      const discount = {
        type: 'PERCENTAGE',
        value: 20,
        applicableScope: 'SPECIFIC_PRODUCTS',
        products: [{ id: 'coffee-prod-1' } as Product],
      } as Discount;

      const items = [
        { productId: 'food-prod-1', unitPrice: 30000, quantity: 1 }, // Rp 30.000 (not eligible)
        { productId: 'coffee-prod-1', unitPrice: 20000, quantity: 2 }, // Rp 40.000 (eligible!)
      ];
      const subtotal = 70000;

      // 20% of Rp 40.000 = Rp 8.000
      const result = service.calculateDiscount(discount, items, subtotal);
      expect(result).toBe(8000);
    });
  });

  describe('findById', () => {
    it('returns discount when found', async () => {
      const mockDiscount = {
        id: 'd-1',
        tenantId: mockTenantId,
        name: 'Promo 1',
      };
      discountRepo.findOne.mockResolvedValue(mockDiscount);

      const result = await service.findById(mockTenantId, 'd-1');
      expect(result).toEqual(mockDiscount);
    });

    it('throws NotFoundException when discount is not found', async () => {
      discountRepo.findOne.mockResolvedValue(null);

      await expect(
        service.findById(mockTenantId, 'non-existent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('creates ALWAYS_ACTIVE discount successfully with outletId', async () => {
      outletRepo.findOne.mockResolvedValue({ id: mockOutletId });

      const dto = {
        outletId: mockOutletId,
        name: 'Member 5%',
        type: 'PERCENTAGE' as const,
        value: 5,
        validityType: 'ALWAYS_ACTIVE' as const,
      };

      const result = await service.create(mockTenantId, dto, mockUserId);

      expect(result.id).toBe('discount-uuid-1');
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'DISCOUNT_CREATED' }),
      );
    });

    it('throws BadRequestException if percentage > 100', async () => {
      const dto = {
        name: 'Invalid 150%',
        type: 'PERCENTAGE' as const,
        value: 150,
        validityType: 'ALWAYS_ACTIVE' as const,
      };

      await expect(
        service.create(mockTenantId, dto, mockUserId),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException if RECURRING_WEEKLY has no recurringDays', async () => {
      const dto = {
        name: 'Weekend Promo',
        type: 'PERCENTAGE' as const,
        value: 10,
        validityType: 'RECURRING_WEEKLY' as const,
        recurringDays: [],
      };

      await expect(
        service.create(mockTenantId, dto, mockUserId),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException if DATE_RANGE has missing start/end date', async () => {
      const dto = {
        name: 'Flash Sale',
        type: 'FIXED' as const,
        value: 10000,
        validityType: 'DATE_RANGE' as const,
      };

      await expect(
        service.create(mockTenantId, dto, mockUserId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('returns discounts with formatted validity descriptions', async () => {
      const mockDiscounts = [
        {
          id: 'd-1',
          name: 'Member 5%',
          type: 'PERCENTAGE',
          value: 5,
          validityType: 'ALWAYS_ACTIVE',
          status: 'ACTIVE',
          products: [],
        },
        {
          id: 'd-2',
          name: 'Weekend 10%',
          type: 'PERCENTAGE',
          value: 10,
          validityType: 'RECURRING_WEEKLY',
          recurringDays: ['SATURDAY', 'SUNDAY'],
          status: 'ACTIVE',
          products: [],
        },
      ];

      const qb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockDiscounts),
      };
      discountRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll(mockTenantId, {});

      expect(result).toHaveLength(2);
      expect(result[0].validityDescription).toBe('Always Active (No end date)');
      expect(result[1].validityDescription).toBe('SATURDAY, SUNDAY');
    });
  });

  describe('delete', () => {
    it('soft deletes discount and records audit', async () => {
      discountRepo.findOne.mockResolvedValue({
        id: 'd-1',
        name: 'Old Promo',
        tenantId: mockTenantId,
      });

      const result = await service.delete(mockTenantId, 'd-1', mockUserId);

      expect(discountRepo.softDelete).toHaveBeenCalledWith({
        id: 'd-1',
        tenantId: mockTenantId,
      });
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'DISCOUNT_DELETED' }),
      );
      expect(result.success).toBe(true);
    });
  });
});
