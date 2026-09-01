import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, SelectQueryBuilder } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { InventoryItem } from '../entities/inventory-item.entity';
import { InventoryStock } from '../entities/inventory-stock.entity';
import { InventoryMovement } from '../entities/inventory-movement.entity';
import { ReasonCategory } from '../entities/reason-category.entity';
import { Outlet } from '../../outlet/outlet.entity';
import { AuditService } from '../../audit/audit.service';

describe('InventoryService', () => {
  let service: InventoryService;

  const mockItemRepo = {
    createQueryBuilder: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    softRemove: jest.fn(),
  };

  const mockStockRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockMovementRepo = {
    createQueryBuilder: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockReasonRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    softRemove: jest.fn(),
  };

  const mockOutletRepo = {
    findOne: jest.fn(),
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
          provide: getRepositoryToken(InventoryMovement),
          useValue: mockMovementRepo,
        },
        {
          provide: getRepositoryToken(ReasonCategory),
          useValue: mockReasonRepo,
        },
        {
          provide: getRepositoryToken(Outlet),
          useValue: mockOutletRepo,
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

  describe('createAdjustment', () => {
    it('successfully processes IN adjustment and increases stock', async () => {
      mockOutletRepo.findOne.mockResolvedValue({
        id: 'outlet-1',
        tenantId: 'tenant-1',
      });
      mockItemRepo.findOne.mockResolvedValue({
        id: 'item-1',
        tenantId: 'tenant-1',
      });
      mockReasonRepo.findOne.mockResolvedValue({
        id: 'reason-1',
        tenantId: 'tenant-1',
        type: 'BOTH',
      });

      const stock = {
        id: 'stock-1',
        tenantId: 'tenant-1',
        outletId: 'outlet-1',
        inventoryItemId: 'item-1',
        quantity: 10,
      };

      const managerStockRepo = {
        findOne: jest.fn().mockResolvedValue(stock),
        save: jest
          .fn()
          .mockImplementation((s: InventoryStock) => Promise.resolve(s)),
      };
      const managerMovementRepo = {
        create: jest.fn((m: Record<string, unknown>) => ({
          ...m,
          id: 'mov-1',
        })),
        save: jest.fn((m: Record<string, unknown>) => Promise.resolve(m)),
      };
      const managerAuditRepo = {
        save: jest.fn().mockResolvedValue({}),
      };

      mockDataSource.transaction.mockImplementation(
        (callback: (m: unknown) => Promise<unknown>) => {
          return callback({
            getRepository: (entityClass: unknown) => {
              if (entityClass === InventoryStock) return managerStockRepo;
              if (entityClass === InventoryMovement) return managerMovementRepo;
              return managerAuditRepo;
            },
          });
        },
      );

      const result = (await service.createAdjustment(
        'tenant-1',
        'user-1',
        'outlet-1',
        {
          type: 'IN',
          itemId: 'item-1',
          quantity: 5,
          reasonCategoryId: 'reason-1',
        },
      )) as { currentStock: number; previousStock: number };

      expect(result.previousStock).toBe(10);
      expect(result.currentStock).toBe(15);
      expect(mockDataSource.transaction).toHaveBeenCalled();
    });

    it('rejects OUT adjustment if stock balance is insufficient', async () => {
      mockOutletRepo.findOne.mockResolvedValue({
        id: 'outlet-1',
        tenantId: 'tenant-1',
      });
      mockItemRepo.findOne.mockResolvedValue({
        id: 'item-1',
        tenantId: 'tenant-1',
      });

      const stock = {
        id: 'stock-1',
        tenantId: 'tenant-1',
        outletId: 'outlet-1',
        inventoryItemId: 'item-1',
        quantity: 2,
      };

      const managerStockRepo = {
        findOne: jest.fn().mockResolvedValue(stock),
      };

      mockDataSource.transaction.mockImplementation(
        (callback: (m: unknown) => Promise<unknown>) => {
          return callback({
            getRepository: () => managerStockRepo,
          });
        },
      );

      await expect(
        service.createAdjustment('tenant-1', 'user-1', 'outlet-1', {
          type: 'OUT',
          itemId: 'item-1',
          quantity: 10,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findMovements', () => {
    it('returns paginated movements scoped to tenantId', async () => {
      const qb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([
          [
            {
              id: 'mov-1',
              movementType: 'IN',
              quantity: 5,
              tenantId: 'tenant-1',
            },
          ],
          1,
        ]),
      } as unknown as SelectQueryBuilder<InventoryMovement>;
      mockMovementRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findMovements('tenant-1', {
        page: 1,
        limit: 10,
        movementType: 'IN',
      });

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });
  });
});
