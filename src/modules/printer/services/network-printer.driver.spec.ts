import { EventEmitter } from 'events';
import * as net from 'net';
import { NetworkPrinterDriver } from './network-printer.driver';

class MockSocket extends EventEmitter {
  setTimeout = jest.fn();
  destroy = jest.fn();
  connect = jest.fn((port: number, host: string, cb?: () => void) => {
    if (cb) cb();
    return this;
  });
  write = jest.fn((data: unknown, cb?: (err?: Error) => void) => {
    if (cb) cb();
    return true;
  });
  end = jest.fn((cb?: () => void) => {
    if (cb) cb();
    return this;
  });
}

describe('NetworkPrinterDriver', () => {
  let driver: NetworkPrinterDriver;

  beforeEach(() => {
    driver = new NetworkPrinterDriver();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('successfully sends data to network printer', async () => {
    const mockSocket = new MockSocket();
    driver.createSocket = jest.fn(() => mockSocket as unknown as net.Socket);

    const promise = driver.send({
      ipAddress: '192.168.1.100',
      port: 9100,
      data: Buffer.from('test data'),
    });

    await expect(promise).resolves.toBeUndefined();
    expect(mockSocket.connect).toHaveBeenCalledWith(
      9100,
      '192.168.1.100',
      expect.any(Function),
    );
    expect(mockSocket.write).toHaveBeenCalledWith(
      Buffer.from('test data'),
      expect.any(Function),
    );
    expect(mockSocket.end).toHaveBeenCalled();
  });

  it('rejects with PRINTER_TIMEOUT on connection timeout', async () => {
    const mockSocket = new MockSocket();
    mockSocket.connect.mockImplementation(() => {
      setTimeout(() => mockSocket.emit('timeout'), 10);
      return mockSocket;
    });
    driver.createSocket = jest.fn(() => mockSocket as unknown as net.Socket);

    const promise = driver.send({
      ipAddress: '192.168.1.200',
      port: 9100,
      data: Buffer.from('test'),
      timeoutMs: 50,
    });

    await expect(promise).rejects.toThrow('PRINTER_TIMEOUT');
    expect(mockSocket.destroy).toHaveBeenCalled();
  });

  it('rejects with PRINTER_UNREACHABLE on socket connection error', async () => {
    const mockSocket = new MockSocket();
    mockSocket.connect.mockImplementation(() => {
      setTimeout(() => mockSocket.emit('error', new Error('ECONNREFUSED')), 10);
      return mockSocket;
    });
    driver.createSocket = jest.fn(() => mockSocket as unknown as net.Socket);

    const promise = driver.send({
      ipAddress: '192.168.1.50',
      port: 9100,
      data: Buffer.from('test'),
    });

    await expect(promise).rejects.toThrow('PRINTER_UNREACHABLE');
    expect(mockSocket.destroy).toHaveBeenCalled();
  });
});
