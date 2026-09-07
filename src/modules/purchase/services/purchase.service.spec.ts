import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';
import { PurchaseService } from './purchase.service';
import { Purchase } from '../entities/purchase.entity';
import { PurchaseItem } from '../entities/purchase-item.entity';
import { Outlet } from '../../outlet/outlet.entity';
import { Supplier } from '../../supplier/entities/supplier.entity';
import { InventoryItem } from '../../inventory/entities/inventory-item.entity';
import { InventoryStock } from '../../inventory/entities/inventory-stock.entity';
import { InventoryMovement } from '../../inventory/entities/inventory-movement.entity';
import { Packaging } from '../../packaging/entities/packaging.entity';
import { AuditService } from '../../audit/audit.service';

describe('PurchaseService', () => {
  let service: PurchaseService;
  let purchaseRepo: jest.Mocked<Repository<Purchase>>;
  let purchaseItemRepo: jest.Mocked<Repository<PurchaseItem>>;
  let outletRepo: jest.Mocked<Repository<Outlet>>;
  let supplierRepo: jest.Mocked<Repository<Supplier>>;
  let inventoryItemRepo: jest.Mocked<Repository<InventoryItem>>;
  let stockRepo: jest.Mocked<Repository<InventoryStock>>;
  let movementRepo: jest.Mocked<Repository<InventoryMovement>>;
  let packagingRepo: jest.Mocked<Repository<Packaging>>;
  let dataSource: jest.Mocked<DataSource>;
  let auditService: jest.Mocked<AuditService>;

  const mockPurchase: Purchase = {
    id: 'pur-1',
    tenantId: 'tenant-1',
    outletId: 'outlet-1',
    supplierId: 'supp-1',
    purchaseNumber: 'PB-2024-001',
    purchaseDate: new Date(),
    status: 'DRAFT',
    totalItems: 1,
    subtotal: 13000,
    totalAmount: 13000,
    notes: 'Draft order susu',
    receivedAt: null,
    receivedBy: null,
    createdBy: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    tenant: {} as any,
    outlet: {} as any,
    supplier: { id: 'supp-1', name: 'PT Sumber Makmur' } as any,
    receiver: null,
    creator: {} as any,
    items: [
      {
        id: 'item-row-1',
        tenantId: 'tenant-1',
        purchaseId: 'pur-1',
        inventoryItemId: 'inv-susu',
        quantityOrdered: 1000,
        quantityReceived: 0,
        unitCost: 13,
        subtotal: 13000,
        createdAt: new Date(),
        updatedAt: new Date(),
        tenant: {} as any,
        purchase: {} as any,
        inventoryItem: {
          id: 'inv-susu',
          name: 'Fresh Milk',
          unitCost: 0,
        } as any,
      },
    ],
  };

  beforeEach(async () => {
    purchaseRepo = {
      createQueryBuilder: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      softRemove: jest.fn(),
    } as any;

    purchaseItemRepo = {
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      createQueryBuilder: jest.fn(),
    } as any;

    outletRepo = { findOne: jest.fn() } as any;
    supplierRepo = { findOne: jest.fn() } as any;
    inventoryItemRepo = { findOne: jest.fn(), update: jest.fn() } as any;
    stockRepo = { findOne: jest.fn(), create: jest.fn(), save: jest.fn() } as any;
    movementRepo = { create: jest.fn(), save: jest.fn() } as any;
    packagingRepo = { update: jest.fn() } as any;
    auditService = { record: jest.fn().mockResolvedValue(undefined) } as any;

    dataSource = {
      transaction: jest.fn().mockImplementation((cb) => {
        const manager = {
          getRepository: (entity: any) => {
            if (entity === Purchase) return purchaseRepo;
            if (entity === PurchaseItem) return purchaseItemRepo;
            if (entity === InventoryStock) return stockRepo;
            if (entity === InventoryMovement) return movementRepo;
            if (entity === InventoryItem) return inventoryItemRepo;
            if (entity === Packaging) return packagingRepo;
            return {};
          },
        };
        return cb(manager);
      }),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PurchaseService,
        { provide: getRepositoryToken(Purchase), useValue: purchaseRepo },
        { provide: getRepositoryToken(PurchaseItem), useValue: purchaseItemRepo },
        { provide: getRepositoryToken(Outlet), useValue: outletRepo },
        { provide: getRepositoryToken(Supplier), useValue: supplierRepo },
        { provide: getRepositoryToken(InventoryItem), useValue: inventoryItemRepo },
        { provide: getRepositoryToken(InventoryStock), useValue: stockRepo },
        { provide: getRepositoryToken(InventoryMovement), useValue: movementRepo },
        { provide: getRepositoryToken(Packaging), useValue: packagingRepo },
        { provide: DataSource, useValue: dataSource },
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();

    service = module.get<PurchaseService>(PurchaseService);
  });

  describe('findAll', () => {
    it('returns paginated purchases with search and filters', async () => {
      const qb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[mockPurchase], 1]),
      } as unknown as SelectQueryBuilder<Purchase>;

      purchaseRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll('tenant-1', {
        page: 1,
        limit: 10,
        status: 'DRAFT',
        search: 'PB-2024',
      });

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(qb.where).toHaveBeenCalledWith('purchase.tenantId = :tenantId', {
        tenantId: 'tenant-1',
      });
    });
  });

  describe('findById', () => {
    it('returns purchase detail when found', async () => {
      purchaseRepo.findOne.mockResolvedValue(mockPurchase);

      const result = await service.findById('tenant-1', 'pur-1');
      expect(result).toEqual(mockPurchase);
    });

    it('throws NotFoundException when purchase is not found', async () => {
      purchaseRepo.findOne.mockResolvedValue(null);

      await expect(service.findById('tenant-1', 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('creates a new purchase with status DRAFT without changing stock', async () => {
      outletRepo.findOne.mockResolvedValue({ id: 'outlet-1', tenantId: 'tenant-1' } as any);
      supplierRepo.findOne.mockResolvedValue({ id: 'supp-1', tenantId: 'tenant-1' } as any);
      inventoryItemRepo.findOne.mockResolvedValue({ id: 'inv-susu', tenantId: 'tenant-1' } as any);

      const qbNum = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      } as any;
      purchaseRepo.createQueryBuilder.mockReturnValue(qbNum);

      purchaseItemRepo.create.mockImplementation((d) => d as any);
      purchaseRepo.create.mockReturnValue(mockPurchase);
      purchaseRepo.save.mockResolvedValue(mockPurchase);
      purchaseRepo.findOne.mockResolvedValue(mockPurchase);

      const result = await service.create('tenant-1', 'user-1', {
        outletId: 'outlet-1',
        supplierId: 'supp-1',
        items: [
          {
            inventoryItemId: 'inv-susu',
            quantityOrdered: 1000,
            unitCost: 13,
          },
        ],
      });

      expect(result.status).toBe('DRAFT');
      expect(stockRepo.save).not.toHaveBeenCalled();
      expect(movementRepo.save).not.toHaveBeenCalled();
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PURCHASE_CREATED' }),
      );
    });
  });

  describe('receive', () => {
    it('increments inventory stock and recalculates cumulative unit cost upon goods receipt', async () => {
      purchaseRepo.findOne.mockResolvedValue(mockPurchase);
      stockRepo.findOne.mockResolvedValue(null);
      stockRepo.create.mockReturnValue({
        tenantId: 'tenant-1',
        outletId: 'outlet-1',
        inventoryItemId: 'inv-susu',
        quantity: 1000,
      } as any);
      movementRepo.create.mockReturnValue({} as any);

      // Aggregate mock: 1000 ml @ 13 = 13000
      const qbAgg = {
        innerJoin: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ totalCost: 13000, totalQty: 1000 }),
      } as any;
      purchaseItemRepo.createQueryBuilder.mockReturnValue(qbAgg);

      const result = await service.receive('tenant-1', 'pur-1', 'user-1');

      expect(dataSource.transaction).toHaveBeenCalled();
      expect(stockRepo.save).toHaveBeenCalled();
      expect(movementRepo.save).toHaveBeenCalled();
      expect(inventoryItemRepo.update).toHaveBeenCalledWith(
        { id: 'inv-susu', tenantId: 'tenant-1' },
        { unitCost: 13 },
      );
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PURCHASE_RECEIVED' }),
      );
    });

    it('throws BadRequestException if purchase is not in DRAFT status', async () => {
      purchaseRepo.findOne.mockResolvedValue({
        ...mockPurchase,
        status: 'RECEIVED',
      });

      await expect(service.receive('tenant-1', 'pur-1', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});

