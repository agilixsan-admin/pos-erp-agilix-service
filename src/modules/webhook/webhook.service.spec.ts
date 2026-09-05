import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import {
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { WebhookService } from './webhook.service';
import { AuditService } from '../audit/audit.service';
import { ExternalCommand } from './external-command.entity';
import { Tenant } from '../tenant/tenant.entity';
import { Outlet } from '../outlet/outlet.entity';
import { PosSettings } from '../settings/entities/pos-settings.entity';
import { TenantStatus } from '../tenant/tenant-status.enum';
import { ConsoleWebhookDto } from './console-webhook.dto';

describe('WebhookService', () => {
  const apiKey = 'test-console-api-key';

  const mockAuditRecord = jest.fn().mockResolvedValue(undefined);
  const mockAuditService = {
    record: mockAuditRecord,
  } as unknown as AuditService;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'console.apiKey') return apiKey;
      return undefined;
    }),
  } as unknown as ConfigService;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('API Key verification', () => {
    it('throws UnauthorizedException when apiKey is missing', async () => {
      const mockTransaction = jest.fn();
      const dataSource = {
        transaction: mockTransaction,
      } as unknown as DataSource;
      const service = new WebhookService(
        dataSource,
        mockConfigService,
        mockAuditService,
      );

      const payload: ConsoleWebhookDto = {
        event: 'tenant.locked',
        eventId: 'evt-1',
        timestamp: new Date().toISOString(),
        data: { tenantId: 'tenant-1' },
      };

      await expect(service.process(payload, undefined)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockTransaction).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException when apiKey is incorrect', async () => {
      const mockTransaction = jest.fn();
      const dataSource = {
        transaction: mockTransaction,
      } as unknown as DataSource;
      const service = new WebhookService(
        dataSource,
        mockConfigService,
        mockAuditService,
      );

      const payload: ConsoleWebhookDto = {
        event: 'tenant.locked',
        eventId: 'evt-1',
        timestamp: new Date().toISOString(),
        data: { tenantId: 'tenant-1' },
      };

      await expect(service.process(payload, 'wrong-key')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockTransaction).not.toHaveBeenCalled();
    });
  });

  describe('Payload and event validation', () => {
    it('throws BadRequestException for unsupported event types', async () => {
      const mockTransaction = jest.fn();
      const dataSource = {
        transaction: mockTransaction,
      } as unknown as DataSource;
      const service = new WebhookService(
        dataSource,
        mockConfigService,
        mockAuditService,
      );

      const payload: ConsoleWebhookDto = {
        event: 'unknown.event',
        eventId: 'evt-1',
        timestamp: new Date().toISOString(),
        data: { tenantId: 'tenant-1' },
      };

      await expect(service.process(payload, apiKey)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockTransaction).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when tenantId is missing from data', async () => {
      const dataSource = { transaction: jest.fn() } as unknown as DataSource;
      const service = new WebhookService(
        dataSource,
        mockConfigService,
        mockAuditService,
      );

      const payload: ConsoleWebhookDto = {
        event: 'tenant.locked',
        eventId: 'evt-1',
        timestamp: new Date().toISOString(),
        data: {},
      };

      await expect(service.process(payload, apiKey)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('Idempotency', () => {
    it('returns success and skips processing when event was already processed', async () => {
      const commandRepo = {
        findOne: jest.fn().mockResolvedValue({
          id: 'cmd-1',
          eventId: 'evt-duplicate',
          status: 'PROCESSED',
        }),
      };

      const manager = {
        getRepository: jest.fn().mockReturnValue(commandRepo),
      };

      const dataSource = {
        transaction: jest.fn((cb: (m: typeof manager) => Promise<unknown>) =>
          cb(manager),
        ),
      } as unknown as DataSource;

      const service = new WebhookService(
        dataSource,
        mockConfigService,
        mockAuditService,
      );

      const payload: ConsoleWebhookDto = {
        event: 'tenant.locked',
        eventId: 'evt-duplicate',
        timestamp: new Date().toISOString(),
        data: { tenantId: 'tenant-1' },
      };

      const result = await service.process(payload, apiKey);

      expect(result).toEqual({
        success: true,
        message: 'Event already processed',
      });
      expect(commandRepo.findOne).toHaveBeenCalledWith({
        where: { eventId: 'evt-duplicate' },
      });
      expect(mockAuditRecord).not.toHaveBeenCalled();
    });
  });

  describe('tenant.created', () => {
    it('provisions new tenant, initial outlets, and default PosSettings atomically', async () => {
      const tenantRepo = {
        findOne: jest.fn().mockResolvedValue(null),
        create: jest.fn((dto: Partial<Tenant>) => ({ ...dto })),
        save: jest.fn((entity: Partial<Tenant>) => Promise.resolve(entity)),
      };
      const outletRepo = {
        create: jest.fn((dto: Partial<Outlet>) => ({ ...dto })),
        save: jest.fn((entities: Partial<Outlet>[]) =>
          Promise.resolve(entities),
        ),
      };
      const settingsRepo = {
        findOne: jest.fn().mockResolvedValue(null),
        create: jest.fn((dto: Partial<PosSettings>) => ({ ...dto })),
        save: jest.fn((entity: Partial<PosSettings>) =>
          Promise.resolve(entity),
        ),
      };
      const commandRepo = {
        findOne: jest.fn().mockResolvedValue(null),
        create: jest.fn((dto: Partial<ExternalCommand>) => ({ ...dto })),
        save: jest.fn((entity: Partial<ExternalCommand>) =>
          Promise.resolve(entity),
        ),
      };

      const manager = {
        getRepository: jest.fn((entityClass: unknown) => {
          if (entityClass === Tenant) return tenantRepo;
          if (entityClass === Outlet) return outletRepo;
          if (entityClass === PosSettings) return settingsRepo;
          if (entityClass === ExternalCommand) return commandRepo;
          throw new Error('Unknown entity');
        }),
      };

      const dataSource = {
        transaction: jest.fn((cb: (m: typeof manager) => Promise<unknown>) =>
          cb(manager),
        ),
      } as unknown as DataSource;

      const service = new WebhookService(
        dataSource,
        mockConfigService,
        mockAuditService,
      );

      const payload: ConsoleWebhookDto = {
        event: 'tenant.created',
        eventId: 'evt-created-1',
        timestamp: new Date().toISOString(),
        data: {
          tenantId: 'tenant-new-1',
          businessName: 'Coffee Hub',
          ownerName: 'Budi',
          ownerEmail: 'budi@coffee.com',
          ownerPhone: '+62812345678',
          planType: 'PRO',
          outletCount: 2,
          expiryDate: '2026-12-31T23:59:59.000Z',
        },
      };

      const result = await service.process(payload, apiKey);

      expect(result).toEqual({
        success: true,
        message: 'Event processed successfully',
      });

      // Verifies Tenant creation
      expect(tenantRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'tenant-new-1',
          businessName: 'Coffee Hub',
          status: TenantStatus.ACTIVE,
        }),
      );
      expect(tenantRepo.save).toHaveBeenCalled();

      // Verifies Outlets creation
      expect(outletRepo.save).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ name: 'Outlet 1', code: 'OUTLET-1' }),
          expect.objectContaining({ name: 'Outlet 2', code: 'OUTLET-2' }),
        ]),
      );

      // Verifies PosSettings creation
      expect(settingsRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-new-1',
          outletId: null,
          taxEnabled: false,
          taxRate: 0,
          cashEnabled: true,
          qrisEnabled: true,
        }),
      );
      expect(settingsRepo.save).toHaveBeenCalled();

      // Verifies Command status & Audit log
      expect(commandRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          eventId: 'evt-created-1',
          status: 'PROCESSED',
        }),
      );
      expect(mockAuditRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'tenant.created',
          tenantId: 'tenant-new-1',
          actorType: 'CONSOLE',
        }),
        manager,
      );
    });

    it('rejects tenant.created with invalid outletCount', async () => {
      const tenantRepo = {
        findOne: jest.fn().mockResolvedValue(null),
        create: jest.fn((dto: Partial<Tenant>) => ({ ...dto })),
        save: jest.fn((entity: Partial<Tenant>) => Promise.resolve(entity)),
      };
      const commandRepo = {
        findOne: jest.fn().mockResolvedValue(null),
      };
      const manager = {
        getRepository: jest.fn((entityClass: unknown) => {
          if (entityClass === Tenant) return tenantRepo;
          if (entityClass === ExternalCommand) return commandRepo;
          throw new Error('Unknown entity');
        }),
      };
      const dataSource = {
        transaction: jest.fn((cb: (m: typeof manager) => Promise<unknown>) =>
          cb(manager),
        ),
      } as unknown as DataSource;

      const service = new WebhookService(
        dataSource,
        mockConfigService,
        mockAuditService,
      );

      const payload: ConsoleWebhookDto = {
        event: 'tenant.created',
        eventId: 'evt-created-invalid',
        timestamp: new Date().toISOString(),
        data: {
          tenantId: 'tenant-new-2',
          businessName: 'Coffee Hub',
          ownerName: 'Budi',
          ownerEmail: 'budi@coffee.com',
          outletCount: 0,
          planType: 'PRO',
        },
      };

      await expect(service.process(payload, apiKey)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('tenant.updated', () => {
    it('updates tenant profile fields and saves', async () => {
      const existingTenant: Partial<Tenant> = {
        id: 'tenant-1',
        businessName: 'Old Name',
        ownerName: 'Old Owner',
        ownerEmail: 'old@mail.com',
        ownerPhone: '123',
        planType: 'BASIC',
        status: TenantStatus.ACTIVE,
      };

      const tenantRepo = {
        findOne: jest.fn().mockResolvedValue(existingTenant),
        save: jest.fn((entity: Partial<Tenant>) => Promise.resolve(entity)),
      };
      const commandRepo = {
        findOne: jest.fn().mockResolvedValue(null),
        create: jest.fn((dto: Partial<ExternalCommand>) => ({ ...dto })),
        save: jest.fn((entity: Partial<ExternalCommand>) =>
          Promise.resolve(entity),
        ),
      };
      const manager = {
        getRepository: jest.fn((entityClass: unknown) => {
          if (entityClass === Tenant) return tenantRepo;
          if (entityClass === ExternalCommand) return commandRepo;
          throw new Error('Unknown entity');
        }),
      };
      const dataSource = {
        transaction: jest.fn((cb: (m: typeof manager) => Promise<unknown>) =>
          cb(manager),
        ),
      } as unknown as DataSource;

      const service = new WebhookService(
        dataSource,
        mockConfigService,
        mockAuditService,
      );

      const payload: ConsoleWebhookDto = {
        event: 'tenant.updated',
        eventId: 'evt-upd-1',
        timestamp: new Date().toISOString(),
        data: {
          tenantId: 'tenant-1',
          businessName: 'Updated Name',
          ownerName: 'Updated Owner',
          planType: 'ENTERPRISE',
        },
      };

      const result = await service.process(payload, apiKey);

      expect(result.success).toBe(true);
      expect(existingTenant.businessName).toBe('Updated Name');
      expect(existingTenant.ownerName).toBe('Updated Owner');
      expect(existingTenant.planType).toBe('ENTERPRISE');
      expect(tenantRepo.save).toHaveBeenCalledWith(existingTenant);
      expect(mockAuditRecord).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'tenant.updated' }),
        manager,
      );
    });

    it('throws ForbiddenException when tenant is not found', async () => {
      const tenantRepo = {
        findOne: jest.fn().mockResolvedValue(null),
      };
      const commandRepo = {
        findOne: jest.fn().mockResolvedValue(null),
      };
      const manager = {
        getRepository: jest.fn((entityClass: unknown) => {
          if (entityClass === Tenant) return tenantRepo;
          if (entityClass === ExternalCommand) return commandRepo;
          throw new Error('Unknown entity');
        }),
      };
      const dataSource = {
        transaction: jest.fn((cb: (m: typeof manager) => Promise<unknown>) =>
          cb(manager),
        ),
      } as unknown as DataSource;

      const service = new WebhookService(
        dataSource,
        mockConfigService,
        mockAuditService,
      );

      const payload: ConsoleWebhookDto = {
        event: 'tenant.updated',
        eventId: 'evt-upd-missing',
        timestamp: new Date().toISOString(),
        data: { tenantId: 'non-existent' },
      };

      await expect(service.process(payload, apiKey)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('tenant.locked and tenant.unlocked', () => {
    it('locks tenant when tenant.locked is received', async () => {
      const existingTenant: Partial<Tenant> = {
        id: 'tenant-1',
        status: TenantStatus.ACTIVE,
      };

      const tenantRepo = {
        findOne: jest.fn().mockResolvedValue(existingTenant),
        save: jest.fn((entity: Partial<Tenant>) => Promise.resolve(entity)),
      };
      const commandRepo = {
        findOne: jest.fn().mockResolvedValue(null),
        create: jest.fn((dto: Partial<ExternalCommand>) => ({ ...dto })),
        save: jest.fn((entity: Partial<ExternalCommand>) =>
          Promise.resolve(entity),
        ),
      };
      const manager = {
        getRepository: jest.fn((entityClass: unknown) => {
          if (entityClass === Tenant) return tenantRepo;
          if (entityClass === ExternalCommand) return commandRepo;
          throw new Error('Unknown entity');
        }),
      };
      const dataSource = {
        transaction: jest.fn((cb: (m: typeof manager) => Promise<unknown>) =>
          cb(manager),
        ),
      } as unknown as DataSource;

      const service = new WebhookService(
        dataSource,
        mockConfigService,
        mockAuditService,
      );

      const payload: ConsoleWebhookDto = {
        event: 'tenant.locked',
        eventId: 'evt-lock-1',
        timestamp: new Date().toISOString(),
        data: { tenantId: 'tenant-1', reason: 'Subscription unpaid' },
      };

      const result = await service.process(payload, apiKey);

      expect(result.success).toBe(true);
      expect(existingTenant.status).toBe(TenantStatus.LOCKED);
      expect(tenantRepo.save).toHaveBeenCalledWith(existingTenant);
      expect(mockAuditRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'tenant.locked',
          tenantId: 'tenant-1',
        }),
        manager,
      );
    });

    it('unlocks tenant when tenant.unlocked is received', async () => {
      const existingTenant: Partial<Tenant> = {
        id: 'tenant-1',
        status: TenantStatus.LOCKED,
      };

      const tenantRepo = {
        findOne: jest.fn().mockResolvedValue(existingTenant),
        save: jest.fn((entity: Partial<Tenant>) => Promise.resolve(entity)),
      };
      const commandRepo = {
        findOne: jest.fn().mockResolvedValue(null),
        create: jest.fn((dto: Partial<ExternalCommand>) => ({ ...dto })),
        save: jest.fn((entity: Partial<ExternalCommand>) =>
          Promise.resolve(entity),
        ),
      };
      const manager = {
        getRepository: jest.fn((entityClass: unknown) => {
          if (entityClass === Tenant) return tenantRepo;
          if (entityClass === ExternalCommand) return commandRepo;
          throw new Error('Unknown entity');
        }),
      };
      const dataSource = {
        transaction: jest.fn((cb: (m: typeof manager) => Promise<unknown>) =>
          cb(manager),
        ),
      } as unknown as DataSource;

      const service = new WebhookService(
        dataSource,
        mockConfigService,
        mockAuditService,
      );

      const payload: ConsoleWebhookDto = {
        event: 'tenant.unlocked',
        eventId: 'evt-unlock-1',
        timestamp: new Date().toISOString(),
        data: { tenantId: 'tenant-1' },
      };

      const result = await service.process(payload, apiKey);

      expect(result.success).toBe(true);
      expect(existingTenant.status).toBe(TenantStatus.ACTIVE);
      expect(tenantRepo.save).toHaveBeenCalledWith(existingTenant);
      expect(mockAuditRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'tenant.unlocked',
          tenantId: 'tenant-1',
        }),
        manager,
      );
    });
  });

  describe('tenant.deleted', () => {
    it('sets tenant status to LOCKED to preserve historical data while blocking operations', async () => {
      const existingTenant: Partial<Tenant> = {
        id: 'tenant-to-delete',
        status: TenantStatus.ACTIVE,
      };

      const tenantRepo = {
        findOne: jest.fn().mockResolvedValue(existingTenant),
        save: jest.fn((entity: Partial<Tenant>) => Promise.resolve(entity)),
      };
      const commandRepo = {
        findOne: jest.fn().mockResolvedValue(null),
        create: jest.fn((dto: Partial<ExternalCommand>) => ({ ...dto })),
        save: jest.fn((entity: Partial<ExternalCommand>) =>
          Promise.resolve(entity),
        ),
      };
      const manager = {
        getRepository: jest.fn((entityClass: unknown) => {
          if (entityClass === Tenant) return tenantRepo;
          if (entityClass === ExternalCommand) return commandRepo;
          throw new Error('Unknown entity');
        }),
      };
      const dataSource = {
        transaction: jest.fn((cb: (m: typeof manager) => Promise<unknown>) =>
          cb(manager),
        ),
      } as unknown as DataSource;

      const service = new WebhookService(
        dataSource,
        mockConfigService,
        mockAuditService,
      );

      const payload: ConsoleWebhookDto = {
        event: 'tenant.deleted',
        eventId: 'evt-del-1',
        timestamp: new Date().toISOString(),
        data: { tenantId: 'tenant-to-delete' },
      };

      const result = await service.process(payload, apiKey);

      expect(result.success).toBe(true);
      expect(existingTenant.status).toBe(TenantStatus.LOCKED);
      expect(tenantRepo.save).toHaveBeenCalledWith(existingTenant);
      expect(mockAuditRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'tenant.deleted',
          tenantId: 'tenant-to-delete',
        }),
        manager,
      );
    });
  });
});
