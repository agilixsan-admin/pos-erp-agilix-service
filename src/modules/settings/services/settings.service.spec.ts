import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { PosSettings } from '../entities/pos-settings.entity';
import { Outlet } from '../../outlet/outlet.entity';
import { AuditService } from '../../audit/audit.service';

describe('SettingsService', () => {
  let service: SettingsService;
  let settingsRepo: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let outletRepo: {
    findOne: jest.Mock;
  };
  let auditService: {
    record: jest.Mock;
  };

  const mockTenantId = 'tenant-uuid-1';
  const mockOutletId = 'outlet-uuid-1';
  const mockUserId = 'user-uuid-1';

  beforeEach(async () => {
    settingsRepo = {
      findOne: jest.fn(),
      create: jest.fn(
        (dto: Partial<PosSettings>) =>
          ({
            ...dto,
            id: 'settings-uuid-1',
          }) as PosSettings,
      ),
      save: jest.fn((entity: Partial<PosSettings>) =>
        Promise.resolve({
          ...entity,
          id: entity.id || 'settings-uuid-1',
        } as PosSettings),
      ),
    };

    outletRepo = {
      findOne: jest.fn(),
    };

    auditService = {
      record: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettingsService,
        { provide: getRepositoryToken(PosSettings), useValue: settingsRepo },
        { provide: getRepositoryToken(Outlet), useValue: outletRepo },
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();

    service = module.get<SettingsService>(SettingsService);
  });

  describe('getSettings', () => {
    it('returns outlet-specific settings when found', async () => {
      const mockOutletSettings = {
        id: 's-outlet',
        tenantId: mockTenantId,
        outletId: mockOutletId,
        taxEnabled: true,
        taxRate: 11,
      } as PosSettings;
      settingsRepo.findOne.mockResolvedValueOnce(mockOutletSettings);

      const result = await service.getSettings(mockTenantId, mockOutletId);
      expect(result.id).toBe('s-outlet');
      expect(result.taxRate).toBe(11);
    });

    it('falls back to tenant-level settings when outlet-specific settings do not exist', async () => {
      const mockTenantSettings = {
        id: 's-tenant',
        tenantId: mockTenantId,
        outletId: null,
        taxEnabled: true,
        taxRate: 10,
      } as PosSettings;
      settingsRepo.findOne
        .mockResolvedValueOnce(null) // outlet level not found
        .mockResolvedValueOnce(mockTenantSettings); // tenant level found

      const result = await service.getSettings(mockTenantId, mockOutletId);
      expect(result.id).toBe('s-tenant');
      expect(result.taxRate).toBe(10);
    });

    it('auto-creates and returns default settings when neither exists', async () => {
      settingsRepo.findOne.mockResolvedValue(null);

      const result = await service.getSettings(mockTenantId);
      expect(result).toBeDefined();
      expect(result.taxEnabled).toBe(false);
      expect(result.cashEnabled).toBe(true);
      expect(result.qrisEnabled).toBe(true);
      expect(settingsRepo.save).toHaveBeenCalled();
    });
  });

  describe('updateSettings', () => {
    it('throws NotFoundException if specified outlet does not exist', async () => {
      outletRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateSettings(
          mockTenantId,
          { outletId: 'non-existent-outlet', taxEnabled: true },
          mockUserId,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('creates new settings row if no settings exist for outlet', async () => {
      outletRepo.findOne.mockResolvedValue({ id: mockOutletId });
      settingsRepo.findOne.mockResolvedValue(null);

      const result = await service.updateSettings(
        mockTenantId,
        {
          outletId: mockOutletId,
          taxEnabled: true,
          taxRate: 11,
          taxName: 'PPN 11%',
          cashEnabled: false,
        },
        mockUserId,
      );

      expect(result.taxEnabled).toBe(true);
      expect(result.taxRate).toBe(11);
      expect(result.cashEnabled).toBe(false);
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'SETTINGS_UPDATED' }),
      );
    });

    it('updates existing settings row when it already exists', async () => {
      outletRepo.findOne.mockResolvedValue({ id: mockOutletId });
      const existing = {
        id: 's-existing',
        tenantId: mockTenantId,
        outletId: mockOutletId,
        taxEnabled: false,
        taxRate: 0,
        cashEnabled: true,
      } as PosSettings;
      settingsRepo.findOne.mockResolvedValue(existing);

      const result = await service.updateSettings(
        mockTenantId,
        {
          outletId: mockOutletId,
          taxEnabled: true,
          taxRate: 12,
        },
        mockUserId,
      );

      expect(result.taxEnabled).toBe(true);
      expect(result.taxRate).toBe(12);
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'SETTINGS_UPDATED' }),
      );
    });
  });
});
