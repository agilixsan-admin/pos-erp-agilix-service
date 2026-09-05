import { Injectable, Logger } from '@nestjs/common';
import * as net from 'net';

export interface NetworkPrintOptions {
  ipAddress: string;
  port?: number;
  data: Buffer;
  timeoutMs?: number;
}

@Injectable()
export class NetworkPrinterDriver {
  private readonly logger = new Logger(NetworkPrinterDriver.name);

  createSocket(): net.Socket {
    return new net.Socket();
  }

  async send(options: NetworkPrintOptions): Promise<void> {
    const port = options.port || 9100;
    const timeoutMs = options.timeoutMs || 3000;

    return new Promise<void>((resolve, reject) => {
      const socket = this.createSocket();
      let hasCompleted = false;

      const cleanup = () => {
        hasCompleted = true;
        socket.removeAllListeners();
        socket.destroy();
      };

      socket.setTimeout(timeoutMs);

      socket.on('timeout', () => {
        if (!hasCompleted) {
          this.logger.warn(
            `Connection timeout to printer ${options.ipAddress}:${port}`,
          );
          cleanup();
          reject(
            new Error(
              `PRINTER_TIMEOUT: Connection timed out to ${options.ipAddress}:${port}`,
            ),
          );
        }
      });

      socket.on('error', (err: Error) => {
        if (!hasCompleted) {
          this.logger.warn(
            `Connection error to printer ${options.ipAddress}:${port} - ${err.message}`,
          );
          cleanup();
          reject(new Error(`PRINTER_UNREACHABLE: ${err.message}`));
        }
      });

      socket.connect(port, options.ipAddress, () => {
        socket.write(options.data, (err) => {
          if (err) {
            cleanup();
            reject(new Error(`PRINTER_WRITE_ERROR: ${err.message}`));
          } else {
            socket.end(() => {
              cleanup();
              resolve();
            });
          }
        });
      });
    });
  }
}
