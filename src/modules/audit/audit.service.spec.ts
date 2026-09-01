import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuditService } from './audit.service';
import { AuditLog } from './audit-log.entity';

describe('AuditService', () => {
  let service: AuditService;

  const mockLog: AuditLog = {
    id: 'log-1',
    tenantId: 'tenant-1',
    actorType: 'USER',
    actorId: 'user-1',
    action: 'ORDER_CREATED',
    metadata: { orderId: 'order-1' },
    createdAt: new Date('2026-09-01T00:00:00.000Z'),
    tenant: null,
  };

  const mockRepo = {
    create: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        {
          provide: getRepositoryToken(AuditLog),
          useValue: mockRepo,
        },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
  });

  // ─── record ───────────────────────────────────────────────────────────────

  describe('record', () => {
    it('saves an audit log using the injected repository when no manager is provided', async () => {
      mockRepo.create.mockReturnValue(mockLog);
      mockRepo.save.mockResolvedValue(mockLog);

      const result = await service.record({
        action: 'ORDER_CREATED',
        tenantId: 'tenant-1',
        actorType: 'USER',
        actorId: 'user-1',
        metadata: { orderId: 'order-1' },
      });

      expect(mockRepo.create).toHaveBeenCalledWith({
        action: 'ORDER_CREATED',
        tenantId: 'tenant-1',
        actorType: 'USER',
        actorId: 'user-1',
        metadata: { orderId: 'order-1' },
      });
      expect(mockRepo.save).toHaveBeenCalledWith(mockLog);
      expect(result).toEqual(mockLog);
    });

    it('uses the provided EntityManager repository when manager is given', async () => {
      const managerRepoCreate = jest.fn().mockReturnValue(mockLog);
      const managerRepoSave = jest.fn().mockResolvedValue(mockLog);
      const managerGetRepository = jest.fn().mockReturnValue({
        create: managerRepoCreate,
        save: managerRepoSave,
      });
      const manager = { getRepository: managerGetRepository };

      const result = await service.record(
        {
          action: 'PAYMENT_COMPLETED',
          tenantId: 'tenant-1',
          actorType: 'USER',
          actorId: 'user-1',
        },
        manager as unknown as import('typeorm').EntityManager,
      );

      expect(managerGetRepository).toHaveBeenCalledWith(AuditLog);
      expect(managerRepoCreate).toHaveBeenCalled();
      expect(managerRepoSave).toHaveBeenCalled();
      expect(mockRepo.save).not.toHaveBeenCalled();
      expect(result).toEqual(mockLog);
    });

    it('defaults actorId to null when not provided', async () => {
      const logWithoutActor: AuditLog = { ...mockLog, actorId: null };
      mockRepo.create.mockReturnValue(logWithoutActor);
      mockRepo.save.mockResolvedValue(logWithoutActor);

      const result = await service.record({
        action: 'TENANT_LOCKED',
        tenantId: 'tenant-1',
        actorType: 'SYSTEM',
      });

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ actorId: null }),
      );
      expect(result.actorId).toBeNull();
    });

    it('defaults metadata to empty object when not provided', async () => {
      const logWithEmptyMeta: AuditLog = { ...mockLog, metadata: {} };
      mockRepo.create.mockReturnValue(logWithEmptyMeta);
      mockRepo.save.mockResolvedValue(logWithEmptyMeta);

      await service.record({
        action: 'TENANT_UNLOCKED',
        tenantId: 'tenant-1',
        actorType: 'SYSTEM',
      });

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ metadata: {} }),
      );
    });

    it('allows tenantId to be null for system-level events', async () => {
      const systemLog: AuditLog = { ...mockLog, tenantId: null };
      mockRepo.create.mockReturnValue(systemLog);
      mockRepo.save.mockResolvedValue(systemLog);

      const result = await service.record({
        action: 'SYSTEM_STARTUP',
        tenantId: null,
        actorType: 'SYSTEM',
      });

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: null }),
      );
      expect(result.tenantId).toBeNull();
    });

    it('propagates repository errors', async () => {
      mockRepo.create.mockReturnValue(mockLog);
      mockRepo.save.mockRejectedValue(new Error('DB connection lost'));

      await expect(
        service.record({
          action: 'ORDER_CREATED',
          tenantId: 'tenant-1',
          actorType: 'USER',
          actorId: 'user-1',
        }),
      ).rejects.toThrow('DB connection lost');
    });

    it('propagates EntityManager errors when manager is provided', async () => {
      const managerRepoSave = jest
        .fn()
        .mockRejectedValue(new Error('Transaction rolled back'));
      const manager = {
        getRepository: jest.fn().mockReturnValue({
          create: jest.fn().mockReturnValue(mockLog),
          save: managerRepoSave,
        }),
      };

      await expect(
        service.record(
          {
            action: 'STOCK_ADJUSTED',
            tenantId: 'tenant-1',
            actorType: 'USER',
            actorId: 'user-1',
          },
          manager as unknown as import('typeorm').EntityManager,
        ),
      ).rejects.toThrow('Transaction rolled back');
    });
  });

  // ─── findAll ──────────────────────────────────────────────────────────────

  describe('findAll', () => {
    const buildQb = (overrides: Record<string, jest.Mock> = {}) => {
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[mockLog], 1]),
        ...overrides,
      };
      mockRepo.createQueryBuilder.mockReturnValue(qb);
      return qb;
    };

    it('returns paginated audit logs scoped to tenantId', async () => {
      const qb = buildQb();

      const result = await service.findAll('tenant-1', { page: 1, limit: 10 });

      expect(mockRepo.createQueryBuilder).toHaveBeenCalledWith('log');
      expect(qb.where).toHaveBeenCalledWith('log.tenant_id = :tenantId', {
        tenantId: 'tenant-1',
      });
      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      });
    });

    it('applies action filter when provided', async () => {
      const qb = buildQb();

      await service.findAll('tenant-1', { action: 'ORDER_CREATED' });

      expect(qb.andWhere).toHaveBeenCalledWith('log.action = :action', {
        action: 'ORDER_CREATED',
      });
    });

    it('applies actorType filter when provided', async () => {
      const qb = buildQb();

      await service.findAll('tenant-1', { actorType: 'USER' });

      expect(qb.andWhere).toHaveBeenCalledWith('log.actor_type = :actorType', {
        actorType: 'USER',
      });
    });

    it('applies actorId filter when provided', async () => {
      const qb = buildQb();

      await service.findAll('tenant-1', { actorId: 'user-1' });

      expect(qb.andWhere).toHaveBeenCalledWith('log.actor_id = :actorId', {
        actorId: 'user-1',
      });
    });

    it('applies startDate filter when provided', async () => {
      const qb = buildQb();

      await service.findAll('tenant-1', {
        startDate: '2026-09-01T00:00:00.000Z',
      });

      expect(qb.andWhere).toHaveBeenCalledWith('log.created_at >= :startDate', {
        startDate: '2026-09-01T00:00:00.000Z',
      });
    });

    it('applies endDate filter when provided', async () => {
      const qb = buildQb();

      await service.findAll('tenant-1', {
        endDate: '2026-09-30T23:59:59.000Z',
      });

      expect(qb.andWhere).toHaveBeenCalledWith('log.created_at <= :endDate', {
        endDate: '2026-09-30T23:59:59.000Z',
      });
    });

    it('does not call andWhere when no filters are provided', async () => {
      const qb = buildQb();

      await service.findAll('tenant-1', {});

      expect(qb.andWhere).not.toHaveBeenCalled();
    });

    it('calculates totalPages correctly when results span multiple pages', async () => {
      buildQb({
        getManyAndCount: jest.fn().mockResolvedValue([[mockLog], 25]),
      });

      const result = await service.findAll('tenant-1', { page: 1, limit: 10 });

      expect(result.meta.totalPages).toBe(3);
      expect(result.meta.total).toBe(25);
    });

    it('uses default page=1 and limit=20 when not provided', async () => {
      const qb = buildQb();

      await service.findAll('tenant-1', {});

      expect(qb.skip).toHaveBeenCalledWith(0);
      expect(qb.take).toHaveBeenCalledWith(20);
    });
  });
});
