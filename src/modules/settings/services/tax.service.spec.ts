import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { TaxService } from './tax.service';
import { Tax } from '../entities/tax.entity';
import { PosSettings } from '../entities/pos-settings.entity';
import { Outlet } from '../../outlet/outlet.entity';
import { AuditService } from '../../audit/audit.service';

describe('TaxService', () => {
  let service: TaxService;

  const mockTaxRepo = {
    createQueryBuilder: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  const mockSettingsRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  };

  const mockOutletRepo = {
    findOne: jest.fn(),
  };

  const mockAuditRecord = jest.fn().mockResolvedValue(undefined);
  const mockAuditService = {
    record: mockAuditRecord,
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaxService,
        {
          provide: getRepositoryToken(Tax),
          useValue: mockTaxRepo,
        },
        {
          provide: getRepositoryToken(PosSettings),
          useValue: mockSettingsRepo,
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

    service = module.get<TaxService>(TaxService);
  });

  describe('findAll', () => {
    it('returns filtered and sorted taxes for the tenant', async () => {
      const qb: any = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          { id: 'tax-1', name: 'PPN 11%', rate: 11, isGlobal: true },
          { id: 'tax-2', name: 'PB1 10%', rate: 10, isGlobal: false },
        ]),
      };

      mockTaxRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll('tenant-1', {
        outletId: 'outlet-1',
        status: 'ACTIVE',
        type: 'INCLUSIVE',
        search: 'PPN',
      });

      expect(qb.where).toHaveBeenCalledWith('tax.tenantId = :tenantId', {
        tenantId: 'tenant-1',
      });
      expect(qb.andWhere).toHaveBeenCalledTimes(4);
      expect(result).toHaveLength(2);
    });
  });

  describe('findById', () => {
    it('returns tax when found', async () => {
      const tax = { id: 'tax-1', tenantId: 'tenant-1', name: 'PPN 11%' };
      mockTaxRepo.findOne.mockResolvedValue(tax);

      const result = await service.findById('tenant-1', 'tax-1');
      expect(result).toEqual(tax);
    });

    it('throws NotFoundException when tax does not exist', async () => {
      mockTaxRepo.findOne.mockResolvedValue(null);

      await expect(service.findById('tenant-1', 'invalid')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('creates new tax successfully', async () => {
      mockTaxRepo.findOne.mockResolvedValue(null);
      mockTaxRepo.create.mockImplementation((d) => ({ ...d, id: 'tax-new' }));
      mockTaxRepo.save.mockImplementation((d) => Promise.resolve(d));

      const result = await service.create('tenant-1', 'user-1', {
        name: 'PPN 11%',
        rate: 11,
        type: 'INCLUSIVE',
        isGlobal: true,
      });

      expect(mockTaxRepo.update).toHaveBeenCalledWith(
        { tenantId: 'tenant-1', isGlobal: true },
        { isGlobal: false },
      );
      expect(result.id).toBe('tax-new');
      expect(mockAuditRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'TAX_CREATED',
          tenantId: 'tenant-1',
          actorId: 'user-1',
        }),
      );
    });

    it('throws ConflictException if tax name already exists in scope', async () => {
      mockTaxRepo.findOne.mockResolvedValue({
        id: 'existing',
        name: 'PPN 11%',
      });

      await expect(
        service.create('tenant-1', 'user-1', {
          name: 'PPN 11%',
          rate: 11,
          type: 'INCLUSIVE',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('update', () => {
    it('updates tax properties successfully', async () => {
      const existingTax = {
        id: 'tax-1',
        tenantId: 'tenant-1',
        name: 'PPN 11%',
        rate: 11,
        type: 'INCLUSIVE',
        status: 'ACTIVE',
        isGlobal: false,
      };

      mockTaxRepo.findOne.mockResolvedValue(existingTax);
      mockTaxRepo.save.mockImplementation((d) => Promise.resolve(d));

      const result = await service.update('tenant-1', 'user-1', 'tax-1', {
        name: 'PPN 12%',
        rate: 12,
        isGlobal: true,
      });

      expect(result.name).toBe('PPN 12%');
      expect(result.rate).toBe(12);
      expect(mockTaxRepo.update).toHaveBeenCalled();
      expect(mockAuditRecord).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'TAX_UPDATED' }),
      );
    });
  });

  describe('delete', () => {
    it('deletes tax and unsets active global tax if matching', async () => {
      const existingTax = {
        id: 'tax-1',
        tenantId: 'tenant-1',
        name: 'PPN 11%',
      };
      mockTaxRepo.findOne.mockResolvedValue(existingTax);
      mockTaxRepo.delete.mockResolvedValue({ affected: 1 });

      const result = await service.delete('tenant-1', 'user-1', 'tax-1');

      expect(mockSettingsRepo.update).toHaveBeenCalledWith(
        { tenantId: 'tenant-1', defaultGlobalTaxId: 'tax-1' },
        { defaultGlobalTaxId: null, taxEnabled: false },
      );
      expect(mockTaxRepo.delete).toHaveBeenCalledWith({
        id: 'tax-1',
        tenantId: 'tenant-1',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('globalConfig', () => {
    it('gets global tax configuration', async () => {
      mockSettingsRepo.findOne.mockResolvedValue({
        taxEnabled: true,
        defaultGlobalTaxId: 'tax-1',
        defaultGlobalTax: { id: 'tax-1', name: 'PPN 11%', rate: 11 },
      });

      const result = await service.getGlobalConfig('tenant-1');
      expect(result.enableTaxCalculation).toBe(true);
      expect(result.defaultGlobalTaxId).toBe('tax-1');
    });

    it('updates global tax configuration', async () => {
      mockSettingsRepo.findOne.mockResolvedValue({
        tenantId: 'tenant-1',
        taxEnabled: false,
      });
      mockTaxRepo.findOne.mockResolvedValue({
        id: 'tax-1',
        tenantId: 'tenant-1',
        name: 'PPN 11%',
        rate: 11,
        status: 'ACTIVE',
      });
      mockSettingsRepo.save.mockImplementation((s) => Promise.resolve(s));

      const result = await service.updateGlobalConfig('tenant-1', 'user-1', {
        enableTaxCalculation: true,
        defaultGlobalTaxId: 'tax-1',
      });

      expect(mockAuditRecord).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'GLOBAL_TAX_CONFIG_UPDATED' }),
      );
      expect(result.enableTaxCalculation).toBe(true);
    });

    it('throws BadRequestException when trying to set an INACTIVE tax as active global tax', async () => {
      mockSettingsRepo.findOne.mockResolvedValue({ tenantId: 'tenant-1' });
      mockTaxRepo.findOne.mockResolvedValue({
        id: 'tax-inactive',
        tenantId: 'tenant-1',
        status: 'INACTIVE',
      });

      await expect(
        service.updateGlobalConfig('tenant-1', 'user-1', {
          enableTaxCalculation: true,
          defaultGlobalTaxId: 'tax-inactive',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
