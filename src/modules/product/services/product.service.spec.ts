import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, SelectQueryBuilder } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ProductService } from './product.service';
import { Product } from '../entities/product.entity';
import { ProductVariant } from '../entities/product-variant.entity';
import { Category } from '../entities/category.entity';
import { AuditService } from '../../audit/audit.service';
import { StorageService } from '../../storage/services/storage.service';

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
  const mockAuditService = {
    record: jest.fn().mockResolvedValue(undefined),
  };
  const mockStorageService = {
    uploadProductImage: jest.fn(),
    deleteProductImage: jest.fn(),
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
        {
          provide: AuditService,
          useValue: mockAuditService,
        },
        {
          provide: StorageService,
          useValue: mockStorageService,
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

      const result = await service.create('tenant-1', 'user-1', {
        name: 'Latte',
        variants: [{ name: 'Regular', price: 25000 }],
      });

      expect(result?.name).toBe('Latte');
      expect(mockDataSource.transaction).toHaveBeenCalled();
    });

    it('throws BadRequestException if category does not belong to tenant', async () => {
      mockCategoryRepo.findOne.mockResolvedValue(null);

      await expect(
        service.create('tenant-1', 'user-1', {
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

      const result = await service.delete('tenant-1', 'user-1', 'prod-1');
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

  describe('uploadImage', () => {
    it('successfully uploads image, deletes old image if exists, and updates product', async () => {
      const product = {
        id: 'prod-1',
        tenantId: 'tenant-1',
        imageUrl:
          'http://localhost:9000/aglix-pos/uploads/tenant-1/products/old.webp',
      };
      mockProductRepo.findOne.mockResolvedValue(product);
      mockStorageService.uploadProductImage.mockResolvedValue(
        'http://localhost:9000/aglix-pos/uploads/tenant-1/products/new.webp',
      );
      mockProductRepo.save.mockImplementation((p: Product) =>
        Promise.resolve(p),
      );

      const file = {
        buffer: Buffer.from('test'),
        mimetype: 'image/png',
        originalname: 'test.png',
        size: 1024,
      } as Express.Multer.File;

      const result = await service.uploadImage(
        'tenant-1',
        'user-1',
        'prod-1',
        file,
      );

      expect(mockStorageService.deleteProductImage).toHaveBeenCalledWith(
        'tenant-1',
        'http://localhost:9000/aglix-pos/uploads/tenant-1/products/old.webp',
      );
      expect(mockStorageService.uploadProductImage).toHaveBeenCalledWith(
        'tenant-1',
        'prod-1',
        file,
      );
      expect(result.imageUrl).toBe(
        'http://localhost:9000/aglix-pos/uploads/tenant-1/products/new.webp',
      );
      expect(mockProductRepo.save).toHaveBeenCalled();
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PRODUCT_IMAGE_UPLOADED' }),
      );
    });

    it('throws NotFoundException if product does not exist for tenant', async () => {
      mockProductRepo.findOne.mockResolvedValue(null);

      const file = {
        buffer: Buffer.from('test'),
        mimetype: 'image/png',
        originalname: 'test.png',
        size: 1024,
      } as Express.Multer.File;

      await expect(
        service.uploadImage('tenant-1', 'user-1', 'non-existent', file),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteImage', () => {
    it('deletes image from storage and resets product imageUrl to null', async () => {
      const product = {
        id: 'prod-1',
        tenantId: 'tenant-1',
        imageUrl:
          'http://localhost:9000/aglix-pos/uploads/tenant-1/products/old.webp',
      };
      mockProductRepo.findOne.mockResolvedValue(product);
      mockProductRepo.save.mockImplementation((p: Product) =>
        Promise.resolve(p),
      );

      const result = await service.deleteImage('tenant-1', 'user-1', 'prod-1');

      expect(mockStorageService.deleteProductImage).toHaveBeenCalledWith(
        'tenant-1',
        'http://localhost:9000/aglix-pos/uploads/tenant-1/products/old.webp',
      );
      expect(result.product.imageUrl).toBeNull();
      expect(mockProductRepo.save).toHaveBeenCalled();
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PRODUCT_IMAGE_DELETED' }),
      );
    });

    it('throws NotFoundException when trying to delete image of non-existent product', async () => {
      mockProductRepo.findOne.mockResolvedValue(null);

      await expect(
        service.deleteImage('tenant-1', 'user-1', 'non-existent'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
