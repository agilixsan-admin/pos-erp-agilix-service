import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, SelectQueryBuilder } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { InventoryItem } from '../entities/inventory-item.entity';
import { InventoryStock } from '../entities/inventory-stock.entity';
import { Outlet } from '../../outlet/outlet.entity';

describe('InventoryService', () => {
  let service: InventoryService;

  const mockItemRepo = {
    createQueryBuilder: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    softRemove: jest.fn(),
  };

  const mockStockRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockOutletRepo = {
    findOne: jest.fn(),
  };

  const mockDataSource = {
    transaction: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        {
          provide: getRepositoryToken(InventoryItem),
          useValue: mockItemRepo,
        },
        {
          provide: getRepositoryToken(InventoryStock),
          useValue: mockStockRepo,
        },
        {
          provide: getRepositoryToken(Outlet),
          useValue: mockOutletRepo,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<InventoryService>(InventoryService);
  });

  describe('findAll', () => {
    it('returns paginated items scoped to tenantId', async () => {
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest
          .fn()
          .mockResolvedValue([
            [{ id: 'item-1', name: 'Coffee Beans', tenantId: 'tenant-1' }],
            1,
          ]),
      } as unknown as SelectQueryBuilder<InventoryItem>;
      mockItemRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll('tenant-1', {
        page: 1,
        limit: 10,
        search: 'Beans',
      });

      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      });
      expect(mockItemRepo.createQueryBuilder).toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('returns item when found for tenant', async () => {
      const item = { id: 'item-1', name: 'Milk', tenantId: 'tenant-1' };
      const qb = {
        where: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(item),
      } as unknown as SelectQueryBuilder<InventoryItem>;
      mockItemRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findById('tenant-1', 'item-1');
      expect(result).toEqual(item);
    });

    it('throws NotFoundException when item belongs to another tenant', async () => {
      const qb = {
        where: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      } as unknown as SelectQueryBuilder<InventoryItem>;
      mockItemRepo.createQueryBuilder.mockReturnValue(qb);

      await expect(
        service.findById('tenant-1', 'item-foreign'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('creates an inventory item for the tenant', async () => {
      const item = {
        id: 'item-1',
        name: 'Sugar',
        tenantId: 'tenant-1',
        unit: 'kg',
      };
      mockItemRepo.create.mockReturnValue(item);
      mockItemRepo.save.mockResolvedValue(item);

      const result = await service.create('tenant-1', {
        name: 'Sugar',
        unit: 'kg',
      });
      expect(result).toEqual(item);
      expect(mockItemRepo.create).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        name: 'Sugar',
        sku: null,
        unit: 'kg',
        minimumStock: 0,
        status: 'ACTIVE',
      });
    });
  });

  describe('setStock', () => {
    it('sets initial outlet stock successfully', async () => {
      const item = { id: 'item-1', name: 'Milk', tenantId: 'tenant-1' };
      const qb = {
        where: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(item),
      } as unknown as SelectQueryBuilder<InventoryItem>;
      mockItemRepo.createQueryBuilder.mockReturnValue(qb);

      const outlet = { id: 'outlet-1', tenantId: 'tenant-1' };
      mockOutletRepo.findOne.mockResolvedValue(outlet);

      const stock = {
        id: 'stock-1',
        tenantId: 'tenant-1',
        outletId: 'outlet-1',
        inventoryItemId: 'item-1',
        quantity: 50,
      };
      mockStockRepo.findOne.mockResolvedValue(null);
      mockStockRepo.create.mockReturnValue(stock);
      mockStockRepo.save.mockResolvedValue(stock);

      const result = await service.setStock('tenant-1', 'item-1', {
        outletId: 'outlet-1',
        quantity: 50,
      });

      expect(result).toEqual(stock);
    });

    it('rejects setting stock if outlet belongs to another tenant', async () => {
      const item = { id: 'item-1', name: 'Milk', tenantId: 'tenant-1' };
      const qb = {
        where: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(item),
      } as unknown as SelectQueryBuilder<InventoryItem>;
      mockItemRepo.createQueryBuilder.mockReturnValue(qb);

      mockOutletRepo.findOne.mockResolvedValue(null);

      await expect(
        service.setStock('tenant-1', 'item-1', {
          outletId: 'outlet-foreign',
          quantity: 10,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
