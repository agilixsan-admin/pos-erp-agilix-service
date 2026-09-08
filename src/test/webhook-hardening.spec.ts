import {
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { WebhookService } from '../modules/webhook/webhook.service';
import { AuditService } from '../modules/audit/audit.service';
import { ConsoleWebhookDto } from '../modules/webhook/console-webhook.dto';
import { ExternalCommand } from '../modules/webhook/external-command.entity';
import { Tenant } from '../modules/tenant/tenant.entity';
import { TenantStatus } from '../modules/tenant/tenant-status.enum';

describe('Webhook Resilience & Hardening Tests (Phase 18)', () => {
  const correctApiKey = 'valid-super-secret-console-key';

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'console.apiKey') return correctApiKey;
      return undefined;
    }),
  } as unknown as ConfigService;

  const mockAuditService = {
    record: jest.fn().mockResolvedValue(undefined),
  } as unknown as AuditService;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1. Webhook Security & Header Authentication', () => {
    it('rejects request when x-console-api-key is missing', async () => {
      const service = new WebhookService(
        {} as any,
        mockConfigService,
        mockAuditService,
      );

      const payload: ConsoleWebhookDto = {
        event: 'tenant.locked',
        eventId: 'evt-sec-1',
        timestamp: new Date().toISOString(),
        data: { tenantId: 'tenant-1' },
      };

      await expect(service.process(payload, undefined)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects request when x-console-api-key is wrong', async () => {
      const service = new WebhookService(
        {} as any,
        mockConfigService,
        mockAuditService,
      );

      const payload: ConsoleWebhookDto = {
        event: 'tenant.locked',
        eventId: 'evt-sec-2',
        timestamp: new Date().toISOString(),
        data: { tenantId: 'tenant-1' },
      };

      await expect(
        service.process(payload, 'incorrect-api-key'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('2. Event Validation Hardening', () => {
    it('rejects unsupported / unknown event types with 400 Bad Request', async () => {
      const service = new WebhookService(
        {} as any,
        mockConfigService,
        mockAuditService,
      );

      const payload: ConsoleWebhookDto = {
        event: 'unsupported.random.event',
        eventId: 'evt-sec-3',
        timestamp: new Date().toISOString(),
        data: { tenantId: 'tenant-1' },
      };

      await expect(service.process(payload, correctApiKey)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects tenant.locked when target tenant does not exist in POS database', async () => {
      const mockCommandRepo = {
        findOne: jest.fn().mockResolvedValue(null),
      };
      const mockTenantRepo = {
        findOne: jest.fn().mockResolvedValue(null), // Tenant not found!
      };

      const mockDataSource = {
        transaction: jest.fn().mockImplementation(async (cb: any) => {
          const fakeManager = {
            getRepository: jest.fn().mockImplementation((entity) => {
              if (entity === ExternalCommand) return mockCommandRepo;
              if (entity === Tenant) return mockTenantRepo;
              return {
                findOne: jest.fn().mockResolvedValue(null),
                save: jest.fn(),
              };
            }),
          };
          return cb(fakeManager);
        }),
      } as unknown as DataSource;

      const service = new WebhookService(
        mockDataSource,
        mockConfigService,
        mockAuditService,
      );

      const payload: ConsoleWebhookDto = {
        event: 'tenant.locked',
        eventId: 'evt-sec-4',
        timestamp: new Date().toISOString(),
        data: { tenantId: 'nonexistent-tenant' },
      };

      await expect(service.process(payload, correctApiKey)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('3. Webhook Idempotency Hardening', () => {
    it('handles duplicate event deliveries idempotently without re-executing logic', async () => {
      const existingCmd: Partial<ExternalCommand> = {
        id: 'cmd-1',
        eventId: 'evt-duplicate-1',
        eventName: 'tenant.locked',
        status: 'PROCESSED',
      };

      const mockSave = jest.fn();
      const mockCommandRepo = {
        findOne: jest.fn().mockResolvedValue(existingCmd), // Duplicate found!
        save: mockSave,
      };
      const mockTenantRepo = {
        save: mockSave,
      };

      const mockDataSource = {
        transaction: jest.fn().mockImplementation(async (cb: any) => {
          const fakeManager = {
            getRepository: jest.fn().mockImplementation((entity) => {
              if (entity === ExternalCommand) return mockCommandRepo;
              if (entity === Tenant) return mockTenantRepo;
              return {
                findOne: jest.fn().mockResolvedValue(null),
                save: mockSave,
              };
            }),
          };
          return cb(fakeManager);
        }),
      } as unknown as DataSource;

      const service = new WebhookService(
        mockDataSource,
        mockConfigService,
        mockAuditService,
      );

      const payload: ConsoleWebhookDto = {
        event: 'tenant.locked',
        eventId: 'evt-duplicate-1',
        timestamp: new Date().toISOString(),
        data: { tenantId: 'tenant-1' },
      };

      const result = await service.process(payload, correctApiKey);

      expect(result).toEqual({
        success: true,
        message: 'Event already processed',
      });
      // Ensure NO mutations were executed
      expect(mockSave).not.toHaveBeenCalled();
    });
  });

  describe('4. Tenant Status Lifecycle (Locked & Unlocked)', () => {
    it('locks tenant and records audit log upon receiving tenant.locked', async () => {
      const mockTenant: Partial<Tenant> = {
        id: 'tenant-1',
        status: TenantStatus.ACTIVE,
      };

      const mockSave = jest.fn().mockImplementation((entity) => {
        return Promise.resolve(entity);
      });

      const mockCommandRepo = {
        findOne: jest.fn().mockResolvedValue(null),
        create: jest.fn((d) => d),
        save: mockSave,
      };
      const mockTenantRepo = {
        findOne: jest.fn().mockResolvedValue(mockTenant),
        save: mockSave,
      };

      const mockDataSource = {
        transaction: jest.fn().mockImplementation(async (cb: any) => {
          const fakeManager = {
            getRepository: jest.fn().mockImplementation((entity) => {
              if (entity === ExternalCommand) return mockCommandRepo;
              if (entity === Tenant) return mockTenantRepo;
              return {
                findOne: jest.fn().mockResolvedValue(null),
                create: jest.fn((d) => d),
                save: mockSave,
              };
            }),
          };
          return cb(fakeManager);
        }),
      } as unknown as DataSource;

      const service = new WebhookService(
        mockDataSource,
        mockConfigService,
        mockAuditService,
      );

      const payload: ConsoleWebhookDto = {
        event: 'tenant.locked',
        eventId: 'evt-lock-1',
        timestamp: new Date().toISOString(),
        data: { tenantId: 'tenant-1', reason: 'Subscription overdue' },
      };

      const result = await service.process(payload, correctApiKey);

      expect(result.success).toBe(true);
      expect(mockTenant.status).toBe(TenantStatus.LOCKED);
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'tenant.locked',
          tenantId: 'tenant-1',
        }),
        expect.anything(),
      );
    });

    it('unlocks tenant and records audit log upon receiving tenant.unlocked', async () => {
      const mockTenant: Partial<Tenant> = {
        id: 'tenant-1',
        status: TenantStatus.LOCKED,
      };

      const mockSave = jest.fn().mockImplementation((entity) => {
        return Promise.resolve(entity);
      });

      const mockCommandRepo = {
        findOne: jest.fn().mockResolvedValue(null),
        create: jest.fn((d) => d),
        save: mockSave,
      };
      const mockTenantRepo = {
        findOne: jest.fn().mockResolvedValue(mockTenant),
        save: mockSave,
      };

      const mockDataSource = {
        transaction: jest.fn().mockImplementation(async (cb: any) => {
          const fakeManager = {
            getRepository: jest.fn().mockImplementation((entity) => {
              if (entity === ExternalCommand) return mockCommandRepo;
              if (entity === Tenant) return mockTenantRepo;
              return {
                findOne: jest.fn().mockResolvedValue(null),
                create: jest.fn((d) => d),
                save: mockSave,
              };
            }),
          };
          return cb(fakeManager);
        }),
      } as unknown as DataSource;

      const service = new WebhookService(
        mockDataSource,
        mockConfigService,
        mockAuditService,
      );

      const payload: ConsoleWebhookDto = {
        event: 'tenant.unlocked',
        eventId: 'evt-unlock-1',
        timestamp: new Date().toISOString(),
        data: { tenantId: 'tenant-1' },
      };

      const result = await service.process(payload, correctApiKey);

      expect(result.success).toBe(true);
      expect(mockTenant.status).toBe(TenantStatus.ACTIVE);
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'tenant.unlocked',
          tenantId: 'tenant-1',
        }),
        expect.anything(),
      );
    });
  });
});
