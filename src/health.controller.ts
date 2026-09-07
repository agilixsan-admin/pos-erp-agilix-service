import {
  Controller,
  Get,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Public } from './common/decorators/public.decorator';

@Controller()
export class HealthController {
  constructor(
    @Optional()
    private readonly dataSource?: DataSource,
  ) {}

  @Get(['health', 'api/v1/health'])
  @Public()
  async getHealth() {
    let dbStatus = 'UNKNOWN';
    let dbLatencyMs: number | null = null;

    if (this.dataSource?.isInitialized) {
      try {
        const start = Date.now();
        await this.dataSource.query('SELECT 1');
        dbLatencyMs = Date.now() - start;
        dbStatus = 'UP';
      } catch (error) {
        throw new ServiceUnavailableException({
          success: false,
          message: 'Database connection failed',
          code: 'DATABASE_UNAVAILABLE',
          data: {
            status: 'DOWN',
            database: {
              status: 'DOWN',
              error:
                error instanceof Error
                  ? error.message
                  : 'Database query failed',
            },
            uptimeSeconds: Math.floor(process.uptime()),
            timestamp: new Date().toISOString(),
          },
        });
      }
    } else if (this.dataSource && !this.dataSource.isInitialized) {
      throw new ServiceUnavailableException({
        success: false,
        message: 'Database is not initialized',
        code: 'DATABASE_UNAVAILABLE',
        data: {
          status: 'DOWN',
          database: {
            status: 'DOWN',
          },
          uptimeSeconds: Math.floor(process.uptime()),
          timestamp: new Date().toISOString(),
        },
      });
    }

    const memoryUsage = process.memoryUsage();

    return {
      success: true,
      message: 'Service is healthy',
      data: {
        status: 'UP',
        database: {
          status: dbStatus,
          latencyMs: dbLatencyMs,
        },
        uptimeSeconds: Math.floor(process.uptime()),
        memory: {
          rssMb: Math.round((memoryUsage.rss / 1024 / 1024) * 100) / 100,
          heapUsedMb:
            Math.round((memoryUsage.heapUsed / 1024 / 1024) * 100) / 100,
          heapTotalMb:
            Math.round((memoryUsage.heapTotal / 1024 / 1024) * 100) / 100,
        },
        timestamp: new Date().toISOString(),
      },
    };
  }
}
