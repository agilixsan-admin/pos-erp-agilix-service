import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { OutletService } from './outlet.service';
import { Outlet } from './outlet.entity';
import { AuditService } from '../audit/audit.service';

describe('OutletService', () => {
  let service: OutletService;

  const mockOutlet: Partial<Outlet> = {
    id: 'outlet-1',
    tenantId: 'tenant-1',
    name: 'Main Branch',
    code: 'MAIN',
    address: 'Jl. Sudirman No. 1',
    phone: '+628123456789',
    status: 'ACTIVE',
  };

  const mockRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockAuditService = {
    record: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OutletService,
        { provide: getRepositoryToken(Outlet), useValue: mockRepo },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<OutletService>(OutletService);
  });

  describe('findForTenant', () => {
    it('returns outlet when it belongs to the tenant', async () => {
      mockRepo.findOne.mockResolvedValue(mockOutlet);

      const result = await service.findForTenant('tenant-1', 'outlet-1');

      expect(result).toEqual(mockOutlet);
      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'outlet-1', tenantId: 'tenant-1' },
      });
    });

    it('returns null when outlet belongs to a different tenant', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      const result = await service.findForTenant('tenant-2', 'outlet-1');

      expect(result).toBeNull();
    });
  });

  describe('findAll', () => {
    it('returns all outlets for the tenant ordered by createdAt', async () => {
      mockRepo.find.mockResolvedValue([mockOutlet]);

      const result = await service.findAll('tenant-1');

      expect(result).toEqual([mockOutlet]);
      expect(mockRepo.find).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1' },
        order: { createdAt: 'ASC' },
      });
    });
  });

  describe('findById', () => {
    it('returns outlet if found', async () => {
      mockRepo.findOne.mockResolvedValue(mockOutlet);

      const result = await service.findById('tenant-1', 'outlet-1');

      expect(result).toEqual(mockOutlet);
    });

    it('throws NotFoundException if outlet not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.findById('tenant-1', 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('creates outlet with provided code', async () => {
      mockRepo.findOne.mockResolvedValue(null); // No duplicate
      mockRepo.create.mockReturnValue({ ...mockOutlet, code: 'CUSTOM' });
      mockRepo.save.mockResolvedValue({ ...mockOutlet, code: 'CUSTOM' });

      const result = await service.create('tenant-1', 'user-1', {
        name: 'Custom Branch',
        code: 'CUSTOM',
        address: 'Jl. Thamrin',
        phone: '+6281111111',
      });

      expect(result.code).toBe('CUSTOM');
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'OUTLET_CREATED',
          tenantId: 'tenant-1',
          actorId: 'user-1',
        }),
      );
    });

    it('throws ConflictException when custom code already exists', async () => {
      mockRepo.findOne.mockResolvedValue(mockOutlet); // Code exists

      await expect(
        service.create('tenant-1', 'user-1', {
          name: 'Main Branch 2',
          code: 'MAIN',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('auto-generates code if not provided', async () => {
      mockRepo.findOne.mockResolvedValue(null); // Candidate is free
      mockRepo.create.mockImplementation(
        (data: Partial<Outlet>) => data as Outlet,
      );
      mockRepo.save.mockImplementation((data: Outlet) =>
        Promise.resolve({ id: 'new-id', ...data }),
      );

      const result = await service.create('tenant-1', 'user-1', {
        name: 'Cabang Baru',
      });

      expect(result.code).toBe('CABANG');
      expect(mockAuditService.record).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('updates outlet successfully', async () => {
      mockRepo.findOne.mockResolvedValue({ ...mockOutlet });
      mockRepo.save.mockImplementation((data: Outlet) => Promise.resolve(data));

      const result = await service.update('tenant-1', 'user-1', 'outlet-1', {
        name: 'Updated Name',
        phone: '+6289999999',
      });

      expect(result.name).toBe('Updated Name');
      expect(result.phone).toBe('+6289999999');
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'OUTLET_UPDATED',
        }),
      );
    });

    it('throws ConflictException if updated code already exists on another outlet', async () => {
      mockRepo.findOne
        .mockResolvedValueOnce({ ...mockOutlet, id: 'outlet-1', code: 'OLD' }) // findById
        .mockResolvedValueOnce({ ...mockOutlet, id: 'outlet-2', code: 'NEW' }); // duplicate check

      await expect(
        service.update('tenant-1', 'user-1', 'outlet-1', {
          code: 'NEW',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('delete', () => {
    it('marks outlet status as INACTIVE and creates audit log', async () => {
      const existing = { ...mockOutlet, status: 'ACTIVE' } as Outlet;
      mockRepo.findOne.mockResolvedValue(existing);
      mockRepo.save.mockImplementation((data: Outlet) => Promise.resolve(data));

      await service.delete('tenant-1', 'user-1', 'outlet-1');

      expect(existing.status).toBe('INACTIVE');
      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'INACTIVE' }),
      );
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'OUTLET_DELETED',
        }),
      );
    });
  });
});
