import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { WebhookService } from './webhook.service';
import { AuditService } from '../audit/audit.service';

describe('WebhookService', () => {
  const payload = {
    event: 'tenant.locked',
    eventId: 'event-1',
    timestamp: '2026-08-26T00:00:00.000Z',
    data: { tenantId: 'tenant-1', reason: 'expired' },
  };

  const mockAuditService = {
    record: jest.fn().mockResolvedValue(undefined),
  } as unknown as AuditService;

  it('rejects an invalid API key before opening a transaction', async () => {
    const transaction = jest.fn();
    const dataSource = { transaction } as unknown as DataSource;
    const config = {
      get: jest.fn().mockReturnValue('expected'),
    } as unknown as ConfigService;
    const service = new WebhookService(dataSource, config, mockAuditService);

    await expect(service.process(payload, 'wrong')).rejects.toMatchObject({
      status: 401,
    });
    expect(transaction).not.toHaveBeenCalled();
  });

  it('returns success for a duplicate event without applying it again', async () => {
    const findOne = jest.fn().mockResolvedValue({ eventId: 'event-1' });
    const commandRepository = { findOne };
    const manager = {
      getRepository: jest.fn().mockReturnValue(commandRepository),
    };
    const transaction = jest.fn(
      (callback: (value: typeof manager) => unknown) => callback(manager),
    );
    const dataSource = { transaction } as unknown as DataSource;
    const config = {
      get: jest.fn().mockReturnValue('expected'),
    } as unknown as ConfigService;
    const service = new WebhookService(dataSource, config, mockAuditService);

    await expect(service.process(payload, 'expected')).resolves.toEqual({
      success: true,
      message: 'Event already processed',
    });
    expect(findOne).toHaveBeenCalledWith({
      where: { eventId: 'event-1' },
    });
  });
});
