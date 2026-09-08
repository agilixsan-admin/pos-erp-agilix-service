import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { StockOpnameService } from './stock-opname.service';
import { StockOpname } from '../entities/stock-opname.entity';
import { StockOpnameItem } from '../entities/stock-opname-item.entity';
import { Outlet } from '../../outlet/outlet.entity';
import { InventoryCategory } from '../../inventory/entities/inventory-category.entity';
import { InventoryItem } from '../../inventory/entities/inventory-item.entity';
import { InventoryStock } from '../../inventory/entities/inventory-stock.entity';
import { AuditService } from '../../audit/audit.service';

describe('StockOpnameService', () => {
  let service: StockOpnameService;
  let opnameRepo: jest.Mocked<Repository<StockOpname>>;
  let opnameItemRepo: jest.Mocked<Repository<StockOpnameItem>>;
  let outletRepo: jest.Mocked<Repository<Outlet>>;
  let categoryRepo: jest.Mocked<Repository<InventoryCategory>>;
  let inventoryItemRepo: jest.Mocked<Repository<InventoryItem>>;
  let inventoryStockRepo: jest.Mocked<Repository<InventoryStock>>;
  let auditService: jest.Mocked<AuditService>;

  const tenantId = 'tenant-123';
  const outletId = 'outlet-123';
  const actorId = 'user-123';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StockOpnameService,
        {
          provide: getRepositoryToken(StockOpname),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(StockOpnameItem),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Outlet),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(InventoryCategory),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(InventoryItem),
          useValue: {
            findOne: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(InventoryStock),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: DataSource,
          useValue: {
            transaction: jest.fn(),
          },
        },
        {
          provide: AuditService,
          useValue: {
            record: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<StockOpnameService>(StockOpnameService);
    opnameRepo = module.get(getRepositoryToken(StockOpname));
    opnameItemRepo = module.get(getRepositoryToken(StockOpnameItem));
    outletRepo = module.get(getRepositoryToken(Outlet));
    categoryRepo = module.get(getRepositoryToken(InventoryCategory));
    inventoryItemRepo = module.get(getRepositoryToken(InventoryItem));
    inventoryStockRepo = module.get(getRepositoryToken(InventoryStock));
    auditService = module.get(AuditService);
  });

  describe('create', () => {
    it('should throw BadRequestException if outlet not found', async () => {
      outletRepo.findOne.mockResolvedValue(null);

      await expect(
        service.create(tenantId, actorId, {
          outletId: 'invalid-outlet',
          scope: 'ALL',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if category scope specified without valid category', async () => {
      outletRepo.findOne.mockResolvedValue({ id: outletId } as Outlet);
      categoryRepo.findOne.mockResolvedValue(null);

      await expect(
        service.create(tenantId, actorId, {
          outletId,
          scope: 'CATEGORY',
          categoryId: 'invalid-category',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create a stock opname session snapshotting current stocks', async () => {
      outletRepo.findOne.mockResolvedValue({ id: outletId } as Outlet);

      const qbMock: any = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          { id: 'item-1', name: 'Coffee Beans', unitCost: 50 },
          { id: 'item-2', name: 'Milk', unitCost: 20 },
        ]),
      };
      inventoryItemRepo.createQueryBuilder.mockReturnValue(qbMock);

      inventoryStockRepo.find.mockResolvedValue([
        { inventoryItemId: 'item-1', quantity: 10 } as InventoryStock,
      ]);

      const lastOpnameQb: any = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({ opnameNumber: 'SO-2026-005' }),
      };
      opnameRepo.createQueryBuilder.mockReturnValue(lastOpnameQb);

      opnameItemRepo.create.mockImplementation((dto) => dto as any);
      opnameRepo.create.mockImplementation((dto) => dto as any);
      opnameRepo.save.mockResolvedValue({
        id: 'so-1',
        opnameNumber: 'SO-2026-006',
      } as any);
      opnameRepo.findOne.mockResolvedValue({
        id: 'so-1',
        opnameNumber: 'SO-2026-006',
        items: [],
      } as any);

      const result = await service.create(tenantId, actorId, {
        outletId,
        scope: 'ALL',
      });

      expect(result).toBeDefined();
      expect(opnameRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId,
          outletId,
          opnameNumber: 'SO-2026-006',
          status: 'IN_PROGRESS',
          totalItems: 2,
        }),
      );
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'STOCK_OPNAME_CREATED',
          tenantId,
          actorId,
        }),
      );
    });
  });

  describe('updateCounts', () => {
    it('should update physical counts, difference, and item statuses', async () => {
      const existingOpname: any = {
        id: 'so-1',
        tenantId,
        status: 'IN_PROGRESS',
        items: [
          {
            id: 'so-item-1',
            inventoryItemId: 'item-1',
            systemStock: 10,
            actualStock: null,
            difference: 0,
            status: 'UNCOUNTED',
            inventoryItem: { unitCost: 50 },
          },
          {
            id: 'so-item-2',
            inventoryItemId: 'item-2',
            systemStock: 5,
            actualStock: null,
            difference: 0,
            status: 'UNCOUNTED',
            inventoryItem: { unitCost: 20 },
          },
        ],
      };

      opnameRepo.findOne.mockResolvedValue(existingOpname);
      opnameItemRepo.save.mockResolvedValue([] as any);
      opnameRepo.save.mockResolvedValue(existingOpname);

      await service.updateCounts(tenantId, 'so-1', actorId, {
        items: [
          {
            inventoryItemId: 'item-1',
            actualStock: 8,
            notes: 'Spilled 2 units',
          },
          { inventoryItemId: 'item-2', actualStock: 5 },
        ],
      });

      expect(existingOpname.items[0].actualStock).toBe(8);
      expect(existingOpname.items[0].difference).toBe(-2);
      expect(existingOpname.items[0].status).toBe('DEFICIT');

      expect(existingOpname.items[1].actualStock).toBe(5);
      expect(existingOpname.items[1].difference).toBe(0);
      expect(existingOpname.items[1].status).toBe('MATCH');

      expect(existingOpname.countedItems).toBe(2);
      expect(existingOpname.matchedItems).toBe(1);
      expect(existingOpname.deficitItems).toBe(1);
      expect(existingOpname.surplusItems).toBe(0);
      expect(existingOpname.totalDifferenceValue).toBe(-100); // -2 * 50 + 0 * 20 = -100

      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'STOCK_OPNAME_COUNTS_UPDATED',
        }),
      );
    });

    it('should throw BadRequestException if updating completed or cancelled session', async () => {
      opnameRepo.findOne.mockResolvedValue({
        id: 'so-1',
        tenantId,
        status: 'COMPLETED',
      } as any);

      await expect(
        service.updateCounts(tenantId, 'so-1', actorId, {
          items: [{ inventoryItemId: 'item-1', actualStock: 10 }],
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('finalize', () => {
    it('should mark session as COMPLETED without mutating inventory stocks', async () => {
      const existingOpname: any = {
        id: 'so-1',
        tenantId,
        status: 'IN_PROGRESS',
        totalItems: 2,
        countedItems: 2,
        matchedItems: 2,
        deficitItems: 0,
        surplusItems: 0,
        totalDifferenceValue: 0,
      };

      opnameRepo.findOne.mockResolvedValue(existingOpname);
      opnameRepo.save.mockResolvedValue(existingOpname);

      await service.finalize(tenantId, 'so-1', actorId, 'Inspection done');

      expect(existingOpname.status).toBe('COMPLETED');
      expect(existingOpname.finalizedBy).toBe(actorId);
      expect(existingOpname.finalizedAt).toBeDefined();

      // Ensure NO inventory stock modifications were triggered
      expect(inventoryStockRepo.save).not.toHaveBeenCalled();

      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'STOCK_OPNAME_FINALIZED',
        }),
      );
    });
  });

  describe('cancel', () => {
    it('should mark session as CANCELLED', async () => {
      const existingOpname: any = {
        id: 'so-1',
        tenantId,
        status: 'IN_PROGRESS',
      };

      opnameRepo.findOne.mockResolvedValue(existingOpname);
      opnameRepo.save.mockResolvedValue(existingOpname);

      await service.cancel(tenantId, 'so-1', actorId);

      expect(existingOpname.status).toBe('CANCELLED');
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'STOCK_OPNAME_CANCELLED',
        }),
      );
    });
  });
});
