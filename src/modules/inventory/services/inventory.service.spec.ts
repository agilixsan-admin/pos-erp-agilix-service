import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, SelectQueryBuilder } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { InventoryItem } from '../entities/inventory-item.entity';
import { InventoryCategory } from '../entities/inventory-category.entity';
import { InventoryStock } from '../entities/inventory-stock.entity';
import { InventoryMovement } from '../entities/inventory-movement.entity';
import { ReasonCategory } from '../entities/reason-category.entity';
import { StockAdjustment } from '../entities/stock-adjustment.entity';
import { Outlet } from '../../outlet/outlet.entity';
import { AuditService } from '../../audit/audit.service';
import { StorageService } from '../../storage/services/storage.service';

describe('InventoryService', () => {
  let service: InventoryService;

  const mockItemRepo = {
    createQueryBuilder: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    softRemove: jest.fn(),
  };

  const mockCategoryRepo = {
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

  const mockAdjustmentRepo = {
    createQueryBuilder: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockOutletRepo = {
    findOne: jest.fn(),
  };

  const mockStorageService = {
    uploadAdjustmentProof: jest
      .fn()
      .mockResolvedValue('https://storage.example.com/proof.webp'),
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
          provide: getRepositoryToken(InventoryCategory),
          useValue: mockCategoryRepo,
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
          provide: getRepositoryToken(StockAdjustment),
          useValue: mockAdjustmentRepo,
        },
        {
          provide: getRepositoryToken(Outlet),
          useValue: mockOutletRepo,
        },
        {
          provide: StorageService,
          useValue: mockStorageService,
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
    it('returns paginated items with computed stock metrics and summary cards scoped to tenantId', async () => {
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([
          [
            {
              id: 'item-1',
              name: 'Beans',
              unitCost: 100,
              minimumStock: 10,
              stocks: [{ quantity: 5 }],
            },
          ],
          1,
        ]),
        getRawOne: jest.fn().mockResolvedValue({
          totalItems: 1,
          totalInventoryValue: 500,
          lowStockCount: 1,
          outOfStockCount: 0,
        }),
      } as unknown as SelectQueryBuilder<InventoryItem>;
      mockItemRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll('tenant-1', {
        page: 1,
        limit: 10,
        itemType: 'RAW_MATERIAL',
        stockStatus: 'LOW_STOCK',
      });
      expect(result.data).toHaveLength(1);
      expect(result.data[0].currentStock).toBe(5);
      expect(result.data[0].stockValue).toBe(500);
      expect(result.data[0].stockStatus).toBe('LOW_STOCK');
      expect(result.meta.total).toBe(1);
      expect(result.summary.totalItems).toBe(1);
      expect(result.summary.totalInventoryValue).toBe(500);
      expect(result.summary.lowStockCount).toBe(1);
    });
  });

  describe('create', () => {
    it('creates an inventory item and returns it', async () => {
      mockItemRepo.findOne.mockResolvedValue(null);
      const findByIdQb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({
          id: 'item-1',
          name: 'Beans',
          tenantId: 'tenant-1',
        }),
      };
      mockItemRepo.createQueryBuilder.mockReturnValue(findByIdQb);
      mockItemRepo.create.mockReturnValue({
        id: 'item-1',
        name: 'Beans',
        tenantId: 'tenant-1',
      });
      mockItemRepo.save.mockResolvedValue({
        id: 'item-1',
        name: 'Beans',
        tenantId: 'tenant-1',
      });

      const result = await service.create('tenant-1', {
        name: 'Beans',
        unit: 'kg',
      });
      expect(result.id).toBe('item-1');
      expect(mockItemRepo.create).toHaveBeenCalled();
      expect(mockItemRepo.save).toHaveBeenCalled();
    });
  });

  describe('createAdjustment', () => {
    it('applies IN adjustment correctly, generates adjustment number, and records stock adjustment entity', async () => {
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
        type: 'IN',
      });

      const lastAdjQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getOne: jest
          .fn()
          .mockResolvedValue({ adjustmentNumber: 'ADJ-2026-002' }),
      };
      mockAdjustmentRepo.createQueryBuilder.mockReturnValue(lastAdjQb);

      const stock = {
        id: 'stock-1',
        tenantId: 'tenant-1',
        outletId: 'outlet-1',
        inventoryItemId: 'item-1',
        quantity: 10,
      };

      const managerStockRepo = {
        findOne: jest.fn().mockResolvedValue(stock),
        create: jest.fn((s: unknown) => s),
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
      const managerAdjustmentRepo = {
        create: jest.fn((a: Record<string, unknown>) => ({
          ...a,
          id: 'adj-1',
        })),
        save: jest.fn((a: Record<string, unknown>) => Promise.resolve(a)),
      };

      mockDataSource.transaction.mockImplementation(
        (callback: (m: unknown) => Promise<unknown>) => {
          return callback({
            getRepository: (entityClass: unknown) => {
              if (entityClass === InventoryStock) return managerStockRepo;
              if (entityClass === InventoryMovement) return managerMovementRepo;
              if (entityClass === StockAdjustment) return managerAdjustmentRepo;
              return {};
            },
          });
        },
      );

      mockAdjustmentRepo.findOne.mockResolvedValue({
        id: 'adj-1',
        adjustmentNumber: 'ADJ-2026-003',
        previousStock: 10,
        quantity: 5,
        currentStock: 15,
        type: 'IN',
        imageUrl: 'https://storage.example.com/proof.webp',
      });

      const result = await service.createAdjustment(
        'tenant-1',
        'user-1',
        'outlet-1',
        {
          type: 'IN',
          itemId: 'item-1',
          quantity: 5,
          reasonCategoryId: 'reason-1',
          imageUrl: 'https://storage.example.com/proof.webp',
        },
      );

      expect(result.adjustmentNumber).toBe('ADJ-2026-003');
      expect(result.previousStock).toBe(10);
      expect(result.currentStock).toBe(15);
      expect(result.imageUrl).toBe('https://storage.example.com/proof.webp');
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

      const lastAdjQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };
      mockAdjustmentRepo.createQueryBuilder.mockReturnValue(lastAdjQb);

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

  describe('findAllAdjustments', () => {
    it('returns paginated adjustments and card summary metrics', async () => {
      const qb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([
          [
            {
              id: 'adj-1',
              adjustmentNumber: 'ADJ-2026-001',
              type: 'OUT',
              quantity: 5,
            },
          ],
          1,
        ]),
        getRawOne: jest.fn().mockResolvedValue({
          totalAdjustments: 1,
          totalIn: 0,
          totalOut: 1,
          totalLossValue: 50000,
        }),
      };
      mockAdjustmentRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAllAdjustments('tenant-1', {
        page: 1,
        limit: 10,
      });

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.summary.totalAdjustments).toBe(1);
      expect(result.summary.totalOut).toBe(1);
      expect(result.summary.totalLossValue).toBe(50000);
    });
  });

  describe('findAdjustmentById', () => {
    it('returns adjustment detail by ID', async () => {
      mockAdjustmentRepo.findOne.mockResolvedValue({
        id: 'adj-1',
        adjustmentNumber: 'ADJ-2026-001',
        type: 'OUT',
        previousStock: 10,
        quantity: 2,
        currentStock: 8,
      });

      const result = await service.findAdjustmentById('tenant-1', 'adj-1');
      expect(result.id).toBe('adj-1');
      expect(result.adjustmentNumber).toBe('ADJ-2026-001');
    });

    it('throws NotFoundException if adjustment not found', async () => {
      mockAdjustmentRepo.findOne.mockResolvedValue(null);

      await expect(
        service.findAdjustmentById('tenant-1', 'invalid-id'),
      ).rejects.toThrow(NotFoundException);
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
      expect(
        (result.data[0] as unknown as { inQuantity: number }).inQuantity,
      ).toBe(5);
      expect(
        (result.data[0] as unknown as { outQuantity: number }).outQuantity,
      ).toBe(0);
      expect(result.meta.total).toBe(1);
    });
  });
});
