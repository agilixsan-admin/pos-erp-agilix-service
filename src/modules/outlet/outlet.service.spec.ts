import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { OutletService } from './outlet.service';
import { Outlet } from './outlet.entity';

describe('OutletService', () => {
  let service: OutletService;

  const mockOutlet: Partial<Outlet> = {
    id: 'outlet-1',
    tenantId: 'tenant-1',
    name: 'Main Branch',
    status: 'ACTIVE',
  };

  const mockRepo = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OutletService,
        { provide: getRepositoryToken(Outlet), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<OutletService>(OutletService);
  });

  // ─── findForTenant ────────────────────────────────────────────────────────

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

    it('returns null when outlet does not exist', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      const result = await service.findForTenant('tenant-1', 'unknown-outlet');

      expect(result).toBeNull();
    });

    it('enforces outlet isolation — tenant A cannot access tenant B outlet', async () => {
      mockRepo.findOne.mockImplementation(
        ({ where }: { where: { id: string; tenantId: string } }) => {
          if (where.tenantId === 'tenant-1' && where.id === 'outlet-b') {
            return Promise.resolve(null);
          }
          return Promise.resolve(mockOutlet);
        },
      );

      const result = await service.findForTenant('tenant-1', 'outlet-b');

      expect(result).toBeNull();
    });
  });
});
