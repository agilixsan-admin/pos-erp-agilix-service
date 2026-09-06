import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SelectQueryBuilder } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PackagingService } from './packaging.service';
import { Packaging } from '../entities/packaging.entity';
import { Outlet } from '../../outlet/outlet.entity';
import { InventoryItem } from '../../inventory/entities/inventory-item.entity';
import { AuditService } from '../../audit/audit.service';

describe('PackagingService', () => {
  let service: PackagingService;

  const mockPackagingRepo = {
    createQueryBuilder: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    softDelete: jest.fn(),
  };

  const mockOutletRepo = {
    findOne: jest.fn(),
  };

  const mockInventoryItemRepo = {
    findOne: jest.fn(),
  };

  const mockAuditService = {
    record: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PackagingService,
        {
          provide: getRepositoryToken(Packaging),
          useValue: mockPackagingRepo,
        },
        {
          provide: getRepositoryToken(Outlet),
          useValue: mockOutletRepo,
        },
        {
          provide: getRepositoryToken(InventoryItem),
          useValue: mockInventoryItemRepo,
        },
        {
          provide: AuditService,
          useValue: mockAuditService,
        },
      ],
    }).compile();

    service = module.get<PackagingService>(PackagingService);
  });

  describe('findAll', () => {
    it('returns paginated packaging items with filters', async () => {
      const leftJoinAndSelect = jest.fn().mockReturnThis();
      const where = jest.fn().mockReturnThis();
      const andWhere = jest.fn().mockReturnThis();
      const orderBy = jest.fn().mockReturnThis();
      const skip = jest.fn().mockReturnThis();
      const take = jest.fn().mockReturnThis();
      const getManyAndCount = jest.fn().mockResolvedValue([
        [
          {
            id: 'pkg-1',
            name: 'Paper Bag',
            extraPrice: 2000,
            status: 'ACTIVE',
            applyToOrderType: 'TAKE_AWAY',
          },
        ],
        1,
      ]);

      const qb = {
        leftJoinAndSelect,
        where,
        andWhere,
        orderBy,
        skip,
        take,
        getManyAndCount,
      } as unknown as SelectQueryBuilder<Packaging>;

      mockPackagingRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll('tenant-1', {
        outletId: 'outlet-1',
        status: 'ACTIVE',
        search: 'Bag',
        page: 1,
        limit: 10,
      });

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(where).toHaveBeenCalledWith('pkg.tenantId = :tenantId', {
        tenantId: 'tenant-1',
      });
      expect(andWhere).toHaveBeenCalledWith(
        '(pkg.outletId = :outletId OR pkg.outletId IS NULL)',
        { outletId: 'outlet-1' },
      );
      expect(andWhere).toHaveBeenCalledWith('pkg.status = :status', {
        status: 'ACTIVE',
      });
    });
  });

  describe('findById', () => {
    it('returns packaging detail when found', async () => {
      const mockPkg = {
        id: 'pkg-1',
        name: 'Takeaway Box',
        tenantId: 'tenant-1',
      };
      mockPackagingRepo.findOne.mockResolvedValue(mockPkg);

      const result = await service.findById('tenant-1', 'pkg-1');

      expect(result).toEqual(mockPkg);
      expect(mockPackagingRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'pkg-1', tenantId: 'tenant-1' },
        relations: { outlet: true, inventoryItem: true },
      });
    });

    it('throws NotFoundException when packaging not found', async () => {
      mockPackagingRepo.findOne.mockResolvedValue(null);

      await expect(service.findById('tenant-1', 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('creates packaging successfully and logs audit', async () => {
      mockOutletRepo.findOne.mockResolvedValue({
        id: 'outlet-1',
        tenantId: 'tenant-1',
      });
      mockInventoryItemRepo.findOne.mockResolvedValue({
        id: 'item-1',
        tenantId: 'tenant-1',
      });

      const createdEntity = {
        id: 'pkg-1',
        name: 'Eco Box',
        tenantId: 'tenant-1',
        outletId: 'outlet-1',
        inventoryItemId: 'item-1',
        extraPrice: 1500,
        applyToOrderType: 'TAKE_AWAY',
        status: 'ACTIVE',
      };

      mockPackagingRepo.create.mockReturnValue(createdEntity);
      mockPackagingRepo.save.mockResolvedValue(createdEntity);
      mockPackagingRepo.findOne.mockResolvedValue(createdEntity);

      const result = await service.create('tenant-1', 'user-1', {
        name: 'Eco Box',
        outletId: 'outlet-1',
        inventoryItemId: 'item-1',
        extraPrice: 1500,
        applyToOrderType: 'TAKE_AWAY',
      });

      expect(result).toEqual(createdEntity);
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PACKAGING_CREATED',
          tenantId: 'tenant-1',
          actorId: 'user-1',
        }),
      );
    });

    it('throws BadRequestException if outlet does not exist', async () => {
      mockOutletRepo.findOne.mockResolvedValue(null);

      await expect(
        service.create('tenant-1', 'user-1', {
          name: 'Box',
          outletId: 'invalid-outlet',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException if inventory item does not exist', async () => {
      mockInventoryItemRepo.findOne.mockResolvedValue(null);

      await expect(
        service.create('tenant-1', 'user-1', {
          name: 'Box',
          inventoryItemId: 'invalid-item',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('update', () => {
    it('updates packaging successfully and logs audit', async () => {
      const existing = {
        id: 'pkg-1',
        tenantId: 'tenant-1',
        name: 'Old Box',
        extraPrice: 1000,
      };
      mockPackagingRepo.findOne
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce({
          ...existing,
          name: 'New Box',
          extraPrice: 2500,
        });
      mockPackagingRepo.save.mockResolvedValue({
        ...existing,
        name: 'New Box',
        extraPrice: 2500,
      });

      const result = await service.update('tenant-1', 'pkg-1', 'user-1', {
        name: 'New Box',
        extraPrice: 2500,
      });

      expect(result.name).toBe('New Box');
      expect(mockPackagingRepo.save).toHaveBeenCalled();
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PACKAGING_UPDATED',
          tenantId: 'tenant-1',
        }),
      );
    });

    it('throws NotFoundException when updating nonexistent packaging', async () => {
      mockPackagingRepo.findOne.mockResolvedValue(null);

      await expect(
        service.update('tenant-1', 'nonexistent', 'user-1', { name: 'Box' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException if updating to invalid outletId', async () => {
      mockPackagingRepo.findOne.mockResolvedValue({
        id: 'pkg-1',
        tenantId: 'tenant-1',
      });
      mockOutletRepo.findOne.mockResolvedValue(null);

      await expect(
        service.update('tenant-1', 'pkg-1', 'user-1', {
          outletId: 'bad-outlet',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException if updating to invalid inventoryItemId', async () => {
      mockPackagingRepo.findOne.mockResolvedValue({
        id: 'pkg-1',
        tenantId: 'tenant-1',
      });
      mockInventoryItemRepo.findOne.mockResolvedValue(null);

      await expect(
        service.update('tenant-1', 'pkg-1', 'user-1', {
          inventoryItemId: 'bad-item',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('delete', () => {
    it('soft-deletes packaging and logs audit', async () => {
      const existing = {
        id: 'pkg-1',
        tenantId: 'tenant-1',
        name: 'Box To Delete',
      };
      mockPackagingRepo.findOne.mockResolvedValue(existing);
      mockPackagingRepo.softDelete.mockResolvedValue({ affected: 1 });

      const result = await service.delete('tenant-1', 'pkg-1', 'user-1');

      expect(result.success).toBe(true);
      expect(mockPackagingRepo.softDelete).toHaveBeenCalledWith('pkg-1');
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PACKAGING_DELETED',
          tenantId: 'tenant-1',
        }),
      );
    });

    it('throws NotFoundException when deleting nonexistent packaging', async () => {
      mockPackagingRepo.findOne.mockResolvedValue(null);

      await expect(
        service.delete('tenant-1', 'nonexistent', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findApplicableForOrder', () => {
    it('queries active packagings matching order type and outlet', async () => {
      const leftJoinAndSelect = jest.fn().mockReturnThis();
      const where = jest.fn().mockReturnThis();
      const andWhere = jest.fn().mockReturnThis();
      const orderBy = jest.fn().mockReturnThis();
      const mockItems = [
        {
          id: 'pkg-1',
          name: 'Box',
          extraPrice: 2000,
          applyToOrderType: 'TAKE_AWAY',
        },
      ];
      const getMany = jest.fn().mockResolvedValue(mockItems);

      const qb = {
        leftJoinAndSelect,
        where,
        andWhere,
        orderBy,
        getMany,
      } as unknown as SelectQueryBuilder<Packaging>;

      mockPackagingRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findApplicableForOrder(
        'tenant-1',
        'outlet-1',
        'TAKE_AWAY',
      );

      expect(result).toEqual(mockItems);
      expect(where).toHaveBeenCalledWith('pkg.tenantId = :tenantId', {
        tenantId: 'tenant-1',
      });
      expect(andWhere).toHaveBeenCalledWith('pkg.status = :status', {
        status: 'ACTIVE',
      });
      expect(andWhere).toHaveBeenCalledWith(
        '(pkg.outletId = :outletId OR pkg.outletId IS NULL)',
        { outletId: 'outlet-1' },
      );
      expect(andWhere).toHaveBeenCalledWith(
        'pkg.applyToOrderType IN (:...orderTypes)',
        { orderTypes: ['TAKE_AWAY', 'ALL'] },
      );
    });
  });
});
