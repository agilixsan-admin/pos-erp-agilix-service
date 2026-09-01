import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TenantService } from './tenant.service';
import { Tenant } from './tenant.entity';
import { TenantStatus } from './tenant-status.enum';

describe('TenantService', () => {
  let service: TenantService;

  const mockTenant: Partial<Tenant> = {
    id: 'tenant-1',
    businessName: 'Test Cafe',
    status: TenantStatus.ACTIVE,
  };

  const findOne = jest.fn();
  const update = jest.fn();
  const addSelect = jest.fn();
  const where = jest.fn();
  const getOne = jest.fn();
  const createQueryBuilder = jest.fn();

  const mockRepo = { findOne, update, createQueryBuilder };

  beforeEach(async () => {
    jest.clearAllMocks();

    addSelect.mockReturnThis();
    where.mockReturnThis();
    createQueryBuilder.mockReturnValue({ addSelect, where, getOne });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantService,
        { provide: getRepositoryToken(Tenant), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<TenantService>(TenantService);
  });

  // ─── findById ─────────────────────────────────────────────────────────────

  describe('findById', () => {
    it('returns tenant when found', async () => {
      findOne.mockResolvedValue(mockTenant);

      const result = await service.findById('tenant-1');

      expect(result).toEqual(mockTenant);
      expect(findOne).toHaveBeenCalledWith({ where: { id: 'tenant-1' } });
    });

    it('returns null when tenant is not found', async () => {
      findOne.mockResolvedValue(null);

      const result = await service.findById('unknown');

      expect(result).toBeNull();
    });
  });

  // ─── findByIdWithSecret ───────────────────────────────────────────────────

  describe('findByIdWithSecret', () => {
    it('uses createQueryBuilder with addSelect to expose consoleApiKey', async () => {
      getOne.mockResolvedValue(mockTenant);

      const result = await service.findByIdWithSecret('tenant-1');

      expect(createQueryBuilder).toHaveBeenCalledWith('tenant');
      expect(addSelect).toHaveBeenCalledWith('tenant.consoleApiKey');
      expect(result).toEqual(mockTenant);
    });
  });

  // ─── setStatus ────────────────────────────────────────────────────────────

  describe('setStatus', () => {
    it('updates status to LOCKED and returns updated tenant', async () => {
      const lockedTenant = { ...mockTenant, status: TenantStatus.LOCKED };
      update.mockResolvedValue(undefined);
      findOne.mockResolvedValue(lockedTenant);

      const result = await service.setStatus('tenant-1', TenantStatus.LOCKED);

      expect(update).toHaveBeenCalledWith(
        { id: 'tenant-1' },
        { status: TenantStatus.LOCKED },
      );
      expect(result?.status).toBe(TenantStatus.LOCKED);
    });

    it('updates status to ACTIVE and returns updated tenant', async () => {
      update.mockResolvedValue(undefined);
      findOne.mockResolvedValue({ ...mockTenant, status: TenantStatus.ACTIVE });

      const result = await service.setStatus('tenant-1', TenantStatus.ACTIVE);

      expect(result?.status).toBe(TenantStatus.ACTIVE);
    });
  });
});
