import { ensureDatabaseExists } from './ensure-database';
import { Client } from 'pg';

jest.mock('pg', () => {
  const mClient = {
    connect: jest.fn(),
    query: jest.fn(),
    end: jest.fn(),
  };
  return { Client: jest.fn(() => mClient) };
});

describe('ensureDatabaseExists', () => {
  const originalEnv = process.env;
  let mockClientInstance: {
    connect: jest.Mock;
    query: jest.Mock;
    end: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    mockClientInstance = new (Client as unknown as jest.Mock)() as {
      connect: jest.Mock;
      query: jest.Mock;
      end: jest.Mock;
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('skips when NODE_ENV is test', async () => {
    process.env.NODE_ENV = 'test';
    process.env.DB_HOST = 'localhost';

    await ensureDatabaseExists();

    expect(mockClientInstance.connect).not.toHaveBeenCalled();
  });

  it('skips when DB_HOST is not set', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.DB_HOST;

    await ensureDatabaseExists();

    expect(mockClientInstance.connect).not.toHaveBeenCalled();
  });

  it('skips in production when DB_AUTO_CREATE is not true', async () => {
    process.env.NODE_ENV = 'production';
    process.env.DB_HOST = 'localhost';
    delete process.env.DB_AUTO_CREATE;

    await ensureDatabaseExists();

    expect(mockClientInstance.connect).not.toHaveBeenCalled();
  });

  it('skips when DB_AUTO_CREATE is explicitly false in development', async () => {
    process.env.NODE_ENV = 'development';
    process.env.DB_HOST = 'localhost';
    process.env.DB_AUTO_CREATE = 'false';

    await ensureDatabaseExists();

    expect(mockClientInstance.connect).not.toHaveBeenCalled();
  });

  it('skips when database name has invalid characters', async () => {
    process.env.NODE_ENV = 'development';
    process.env.DB_HOST = 'localhost';
    process.env.DB_NAME = 'invalid;drop table users;--';

    await ensureDatabaseExists();

    expect(mockClientInstance.connect).not.toHaveBeenCalled();
  });

  it('does not create database if it already exists', async () => {
    process.env.NODE_ENV = 'development';
    process.env.DB_HOST = 'localhost';
    process.env.DB_NAME = 'aglix_pos';

    mockClientInstance.connect.mockResolvedValueOnce(undefined);
    mockClientInstance.query.mockResolvedValueOnce({ rowCount: 1 });
    mockClientInstance.end.mockResolvedValueOnce(undefined);

    await ensureDatabaseExists();

    expect(mockClientInstance.connect).toHaveBeenCalled();
    expect(mockClientInstance.query).toHaveBeenCalledWith(
      'SELECT 1 FROM pg_database WHERE datname = $1;',
      ['aglix_pos'],
    );
    expect(mockClientInstance.query).not.toHaveBeenCalledWith(
      expect.stringContaining('CREATE DATABASE'),
    );
    expect(mockClientInstance.end).toHaveBeenCalled();
  });

  it('creates database when it does not exist', async () => {
    process.env.NODE_ENV = 'development';
    process.env.DB_HOST = 'localhost';
    process.env.DB_NAME = 'aglix_pos';

    mockClientInstance.connect.mockResolvedValueOnce(undefined);
    mockClientInstance.query
      .mockResolvedValueOnce({ rowCount: 0 })
      .mockResolvedValueOnce({ rowCount: 1 });
    mockClientInstance.end.mockResolvedValueOnce(undefined);

    await ensureDatabaseExists();

    expect(mockClientInstance.connect).toHaveBeenCalled();
    expect(mockClientInstance.query).toHaveBeenCalledWith(
      'CREATE DATABASE "aglix_pos";',
    );
    expect(mockClientInstance.end).toHaveBeenCalled();
  });

  it('catches and logs error gracefully without throwing exception', async () => {
    process.env.NODE_ENV = 'development';
    process.env.DB_HOST = 'localhost';
    process.env.DB_NAME = 'aglix_pos';

    mockClientInstance.connect.mockRejectedValueOnce(
      new Error('Connection refused to maintenance db'),
    );

    await expect(ensureDatabaseExists()).resolves.toBeUndefined();
    expect(mockClientInstance.end).toHaveBeenCalled();
  });
});
