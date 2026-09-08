import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { SupplierService } from './supplier.service';
import { Supplier } from '../entities/supplier.entity';
import { AuditService } from '../../audit/audit.service';

describe('SupplierService', () => {
  let service: SupplierService;
  let supplierRepo: jest.Mocked<Repository<Supplier>>;
  let auditService: jest.Mocked<AuditService>;

  const mockSupplier: Supplier = {
    id: 'supp-1',
    tenantId: 'tenant-1',
    code: 'SUP-001',
    name: 'PT Sumber Makmur',
    contactPerson: 'Budi Santoso',
    phone: '081234567890',
    email: 'budi@sumbermakmur.com',
    address: 'Jl. Industri No. 1',
    city: 'Jakarta',
    province: 'DKI Jakarta',
    postalCode: '10110',
    notes: 'Supplier utama kopi',
    status: 'ACTIVE',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    tenant: {} as any,
  };

  beforeEach(async () => {
    const mockRepo = {
      createQueryBuilder: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      softRemove: jest.fn(),
    };

    const mockAudit = {
      record: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupplierService,
        {
          provide: getRepositoryToken(Supplier),
          useValue: mockRepo,
        },
        {
          provide: AuditService,
          useValue: mockAudit,
        },
      ],
    }).compile();

    service = module.get<SupplierService>(SupplierService);
    supplierRepo = module.get(getRepositoryToken(Supplier));
    auditService = module.get(AuditService);
  });

  describe('findAll', () => {
    it('returns paginated suppliers with filters', async () => {
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[mockSupplier], 1]),
      } as unknown as SelectQueryBuilder<Supplier>;

      supplierRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll('tenant-1', {
        page: 1,
        limit: 10,
        status: 'ACTIVE',
        search: 'Sumber',
      });

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.totalPages).toBe(1);
      expect(qb.where).toHaveBeenCalledWith('supplier.tenantId = :tenantId', {
        tenantId: 'tenant-1',
      });
      expect(qb.andWhere).toHaveBeenCalledWith('supplier.status = :status', {
        status: 'ACTIVE',
      });
    });
  });

  describe('findById', () => {
    it('returns supplier when found', async () => {
      supplierRepo.findOne.mockResolvedValue(mockSupplier);

      const result = await service.findById('tenant-1', 'supp-1');
      expect(result).toEqual(mockSupplier);
      expect(supplierRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'supp-1', tenantId: 'tenant-1' },
      });
    });

    it('throws NotFoundException when supplier is not found', async () => {
      supplierRepo.findOne.mockResolvedValue(null);

      await expect(service.findById('tenant-1', 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('creates and saves a supplier successfully', async () => {
      supplierRepo.create.mockReturnValue(mockSupplier);
      supplierRepo.save.mockResolvedValue(mockSupplier);

      const result = await service.create('tenant-1', 'user-1', {
        name: 'PT Sumber Makmur',
        code: 'SUP-001',
        contactPerson: 'Budi Santoso',
        phone: '081234567890',
        email: 'budi@sumbermakmur.com',
      });

      expect(result).toEqual(mockSupplier);
      expect(supplierRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-1',
          name: 'PT Sumber Makmur',
          code: 'SUP-001',
        }),
      );
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'SUPPLIER_CREATED',
          tenantId: 'tenant-1',
          actorId: 'user-1',
        }),
      );
    });
  });

  describe('update', () => {
    it('updates supplier fields and records audit', async () => {
      supplierRepo.findOne.mockResolvedValue(mockSupplier);
      const updatedSupplier = {
        ...mockSupplier,
        name: 'PT Sumber Makmur Sejahtera',
      };
      supplierRepo.save.mockResolvedValue(updatedSupplier);

      const result = await service.update('tenant-1', 'supp-1', 'user-1', {
        name: 'PT Sumber Makmur Sejahtera',
      });

      expect(result.name).toBe('PT Sumber Makmur Sejahtera');
      expect(supplierRepo.save).toHaveBeenCalled();
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'SUPPLIER_UPDATED',
          tenantId: 'tenant-1',
          actorId: 'user-1',
        }),
      );
    });
  });

  describe('delete', () => {
    it('soft deletes supplier and records audit', async () => {
      supplierRepo.findOne.mockResolvedValue(mockSupplier);
      supplierRepo.softRemove.mockResolvedValue(mockSupplier);

      const result = await service.delete('tenant-1', 'supp-1', 'user-1');

      expect(result.success).toBe(true);
      expect(supplierRepo.softRemove).toHaveBeenCalledWith(mockSupplier);
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'SUPPLIER_DELETED',
          tenantId: 'tenant-1',
          actorId: 'user-1',
        }),
      );
    });
  });
});
