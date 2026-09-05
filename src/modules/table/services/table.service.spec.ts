import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SelectQueryBuilder } from 'typeorm';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { TableService } from './table.service';
import { Table } from '../entities/table.entity';
import { Outlet } from '../../outlet/outlet.entity';
import { AuditService } from '../../audit/audit.service';

describe('TableService', () => {
  let service: TableService;

  const mockTableRepo = {
    createQueryBuilder: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  };

  const mockOutletRepo = {
    findOne: jest.fn(),
  };

  const mockAuditService = {
    record: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TableService,
        {
          provide: getRepositoryToken(Table),
          useValue: mockTableRepo,
        },
        {
          provide: getRepositoryToken(Outlet),
          useValue: mockOutletRepo,
        },
        {
          provide: AuditService,
          useValue: mockAuditService,
        },
      ],
    }).compile();

    service = module.get<TableService>(TableService);
  });

  describe('findAll', () => {
    it('returns paginated tables with optional filters', async () => {
      const leftJoinAndSelect = jest.fn().mockReturnThis();
      const where = jest.fn().mockReturnThis();
      const andWhere = jest.fn().mockReturnThis();
      const orderBy = jest.fn().mockReturnThis();
      const skip = jest.fn().mockReturnThis();
      const take = jest.fn().mockReturnThis();
      const getManyAndCount = jest.fn().mockResolvedValue([
        [
          { id: 'tbl-1', name: 'Table 1', status: 'AVAILABLE', capacity: 4 },
          { id: 'tbl-2', name: 'Table 2', status: 'OCCUPIED', capacity: 2 },
        ],
        2,
      ]);

      const qb = {
        leftJoinAndSelect,
        where,
        andWhere,
        orderBy,
        skip,
        take,
        getManyAndCount,
      } as unknown as SelectQueryBuilder<Table>;

      mockTableRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll('tenant-1', {
        outletId: 'outlet-1',
        status: 'AVAILABLE',
        search: 'Table',
        page: 1,
        limit: 10,
      });

      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
      expect(leftJoinAndSelect).toHaveBeenCalledWith('table.outlet', 'outlet');
      expect(where).toHaveBeenCalledWith('table.tenantId = :tenantId', {
        tenantId: 'tenant-1',
      });
      expect(andWhere).toHaveBeenCalledWith('table.outletId = :outletId', {
        outletId: 'outlet-1',
      });
      expect(andWhere).toHaveBeenCalledWith('table.status = :status', {
        status: 'AVAILABLE',
      });
      expect(andWhere).toHaveBeenCalledWith(
        'LOWER(table.name) LIKE LOWER(:search)',
        { search: '%Table%' },
      );
    });
  });

  describe('findById', () => {
    it('returns table when found for tenant', async () => {
      const table = {
        id: 'tbl-1',
        tenantId: 'tenant-1',
        name: 'Table 1',
        status: 'AVAILABLE',
      };
      mockTableRepo.findOne.mockResolvedValue(table);

      const result = await service.findById('tenant-1', 'tbl-1');
      expect(result).toEqual(table);
      expect(mockTableRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'tbl-1', tenantId: 'tenant-1' },
        relations: { outlet: true },
      });
    });

    it('throws NotFoundException when table does not exist', async () => {
      mockTableRepo.findOne.mockResolvedValue(null);

      await expect(service.findById('tenant-1', 'unknown-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('creates table successfully and records audit', async () => {
      mockOutletRepo.findOne.mockResolvedValue({
        id: 'outlet-1',
        tenantId: 'tenant-1',
      });
      mockTableRepo.findOne.mockResolvedValue(null); // no duplicate

      const tableData = {
        id: 'tbl-1',
        tenantId: 'tenant-1',
        outletId: 'outlet-1',
        name: 'Table 10',
        capacity: 4,
        status: 'AVAILABLE',
      };
      mockTableRepo.create.mockReturnValue(tableData);
      mockTableRepo.save.mockResolvedValue(tableData);

      const result = await service.create('tenant-1', 'user-1', {
        outletId: 'outlet-1',
        name: 'Table 10',
        capacity: 4,
      });

      expect(result).toEqual(tableData);
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'TABLE_CREATED',
          tenantId: 'tenant-1',
          actorId: 'user-1',
        }),
      );
    });

    it('throws BadRequestException if outlet is invalid or belongs to another tenant', async () => {
      mockOutletRepo.findOne.mockResolvedValue(null);

      await expect(
        service.create('tenant-1', 'user-1', {
          outletId: 'foreign-outlet',
          name: 'Table 1',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ConflictException if duplicate table name in same outlet', async () => {
      mockOutletRepo.findOne.mockResolvedValue({
        id: 'outlet-1',
        tenantId: 'tenant-1',
      });
      mockTableRepo.findOne.mockResolvedValue({
        id: 'existing-tbl',
        name: 'Table 1',
      });

      await expect(
        service.create('tenant-1', 'user-1', {
          outletId: 'outlet-1',
          name: 'Table 1',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('update', () => {
    it('updates table successfully and records audit', async () => {
      const existing = {
        id: 'tbl-1',
        tenantId: 'tenant-1',
        outletId: 'outlet-1',
        name: 'Table 1',
        capacity: 4,
        status: 'AVAILABLE',
      };
      mockTableRepo.findOne
        .mockResolvedValueOnce(existing) // findById
        .mockResolvedValueOnce(null); // duplicate check
      mockTableRepo.save.mockResolvedValue({
        ...existing,
        name: 'Table 1-Updated',
        capacity: 6,
      });

      const result = await service.update('tenant-1', 'user-1', 'tbl-1', {
        name: 'Table 1-Updated',
        capacity: 6,
      });

      expect(result.name).toBe('Table 1-Updated');
      expect(result.capacity).toBe(6);
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'TABLE_UPDATED',
          tenantId: 'tenant-1',
        }),
      );
    });

    it('throws ConflictException if updating to an existing table name in the outlet', async () => {
      const existing = {
        id: 'tbl-1',
        tenantId: 'tenant-1',
        outletId: 'outlet-1',
        name: 'Table 1',
      };
      mockTableRepo.findOne
        .mockResolvedValueOnce(existing) // findById
        .mockResolvedValueOnce({ id: 'tbl-2', name: 'Table 2' }); // duplicate found with different ID

      await expect(
        service.update('tenant-1', 'user-1', 'tbl-1', {
          name: 'Table 2',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('delete', () => {
    it('deletes an available table successfully and records audit', async () => {
      const existing = {
        id: 'tbl-1',
        tenantId: 'tenant-1',
        name: 'Table 1',
        status: 'AVAILABLE',
      };
      mockTableRepo.findOne.mockResolvedValue(existing);
      mockTableRepo.remove.mockResolvedValue(existing);

      const result = await service.delete('tenant-1', 'user-1', 'tbl-1');
      expect(result.success).toBe(true);
      expect(mockTableRepo.remove).toHaveBeenCalledWith(existing);
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'TABLE_DELETED',
          tenantId: 'tenant-1',
        }),
      );
    });

    it('rejects deletion of an OCCUPIED table', async () => {
      const occupied = {
        id: 'tbl-1',
        tenantId: 'tenant-1',
        name: 'Table 1',
        status: 'OCCUPIED',
      };
      mockTableRepo.findOne.mockResolvedValue(occupied);

      await expect(
        service.delete('tenant-1', 'user-1', 'tbl-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
