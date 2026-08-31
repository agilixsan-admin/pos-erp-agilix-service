import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, SelectQueryBuilder } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ProductService } from './product.service';
import { Product } from '../entities/product.entity';
import { ProductVariant } from '../entities/product-variant.entity';
import { Category } from '../entities/category.entity';

describe('ProductService', () => {
  let service: ProductService;
  const mockProductRepo = {
    createQueryBuilder: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    softRemove: jest.fn(),
  };
  const mockVariantRepo = {
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    softRemove: jest.fn(),
  };
  const mockCategoryRepo = {
    findOne: jest.fn(),
  };
  const mockDataSource = {
    transaction: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductService,
        {
          provide: getRepositoryToken(Product),
          useValue: mockProductRepo,
        },
        {
          provide: getRepositoryToken(ProductVariant),
          useValue: mockVariantRepo,
        },
        {
          provide: getRepositoryToken(Category),
          useValue: mockCategoryRepo,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<ProductService>(ProductService);
  });

  describe('findAll', () => {
    it('returns paginated products with metadata', async () => {
      const qb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest
          .fn()
          .mockResolvedValue([
            [{ id: 'prod-1', name: 'Espresso', tenantId: 'tenant-1' }],
            1,
          ]),
      } as unknown as SelectQueryBuilder<Product>;
      mockProductRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll('tenant-1', {
        page: 1,
        limit: 10,
        search: 'Espresso',
        status: 'ACTIVE',
      });

      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      });
      expect(mockProductRepo.createQueryBuilder).toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('returns product when found for the tenant', async () => {
      const product = {
        id: 'prod-1',
        name: 'Espresso',
        tenantId: 'tenant-1',
        variants: [],
      };
      mockProductRepo.findOne.mockResolvedValue(product);

      const result = await service.findById('tenant-1', 'prod-1');
      expect(result).toEqual(product);
      expect(mockProductRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'prod-1', tenantId: 'tenant-1' },
        relations: { category: true, variants: true },
      });
    });

    it('throws NotFoundException when product is from another tenant', async () => {
      mockProductRepo.findOne.mockResolvedValue(null);

      await expect(service.findById('tenant-1', 'prod-2')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('creates product with variants within a database transaction', async () => {
      const product = {
        id: 'prod-1',
        tenantId: 'tenant-1',
        name: 'Latte',
        status: 'ACTIVE',
      };
      const variant = {
        id: 'var-1',
        productId: 'prod-1',
        tenantId: 'tenant-1',
        name: 'Regular',
        price: 25000,
      };

      const managerRepo = {
        create: jest.fn((entity: Record<string, unknown>) => entity),
        save: jest.fn().mockImplementation((entity: unknown) => {
          if (Array.isArray(entity)) return Promise.resolve(entity);
          return Promise.resolve({
            ...(entity as Record<string, unknown>),
            id: 'prod-1',
          });
        }),
        findOne: jest.fn().mockResolvedValue({
          ...product,
          variants: [variant],
        }),
      };

      mockDataSource.transaction.mockImplementation(
        (callback: (m: unknown) => Promise<unknown>) => {
          return callback({
            getRepository: () => managerRepo,
          });
        },
      );

      const result = await service.create('tenant-1', {
        name: 'Latte',
        variants: [{ name: 'Regular', price: 25000 }],
      });

      expect(result?.name).toBe('Latte');
      expect(mockDataSource.transaction).toHaveBeenCalled();
    });

    it('throws BadRequestException if category does not belong to tenant', async () => {
      mockCategoryRepo.findOne.mockResolvedValue(null);

      await expect(
        service.create('tenant-1', {
          name: 'Latte',
          categoryId: 'cat-foreign',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('delete', () => {
    it('soft removes product and its variants in transaction', async () => {
      const product = {
        id: 'prod-1',
        tenantId: 'tenant-1',
        variants: [{ id: 'var-1' }],
      };
      mockProductRepo.findOne.mockResolvedValue(product);

      const managerProductRepo = {
        softRemove: jest.fn().mockResolvedValue(product),
      };
      const managerVariantRepo = {
        softRemove: jest.fn().mockResolvedValue(product.variants),
      };

      mockDataSource.transaction.mockImplementation(
        (callback: (m: unknown) => Promise<unknown>) => {
          return callback({
            getRepository: (entityClass: unknown) =>
              entityClass === Product ? managerProductRepo : managerVariantRepo,
          });
        },
      );

      const result = await service.delete('tenant-1', 'prod-1');
      expect(result).toEqual({
        success: true,
        message: 'Product deleted successfully',
      });
      expect(managerProductRepo.softRemove).toHaveBeenCalledWith(product);
      expect(managerVariantRepo.softRemove).toHaveBeenCalledWith(
        product.variants,
      );
    });
  });
});
