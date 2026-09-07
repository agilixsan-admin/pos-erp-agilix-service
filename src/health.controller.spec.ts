import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller';
import { DataSource } from 'typeorm';

describe('HealthController', () => {
  it('returns healthy status when database is initialized and responding', async () => {
    const mockDataSource = {
      isInitialized: true,
      query: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    } as unknown as DataSource;

    const controller = new HealthController(mockDataSource);
    const result = await controller.getHealth();

    expect(result.success).toBe(true);
    expect(result.message).toBe('Service is healthy');
    expect(result.data.status).toBe('UP');
    expect(result.data.database.status).toBe('UP');
    expect(typeof result.data.database.latencyMs).toBe('number');
    expect(typeof result.data.uptimeSeconds).toBe('number');
    expect(result.data.memory).toBeDefined();
    expect(mockDataSource.query).toHaveBeenCalledWith('SELECT 1');
  });

  it('throws ServiceUnavailableException (503) when database query fails', async () => {
    const mockDataSource = {
      isInitialized: true,
      query: jest.fn().mockRejectedValue(new Error('Connection lost')),
    } as unknown as DataSource;

    const controller = new HealthController(mockDataSource);

    await expect(controller.getHealth()).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('throws ServiceUnavailableException (503) when database is not initialized', async () => {
    const mockDataSource = {
      isInitialized: false,
      query: jest.fn(),
    } as unknown as DataSource;

    const controller = new HealthController(mockDataSource);

    await expect(controller.getHealth()).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('returns healthy status with UNKNOWN db status when DataSource is not provided', async () => {
    const controller = new HealthController(undefined);
    const result = await controller.getHealth();

    expect(result.success).toBe(true);
    expect(result.data.status).toBe('UP');
    expect(result.data.database.status).toBe('UNKNOWN');
  });
});
