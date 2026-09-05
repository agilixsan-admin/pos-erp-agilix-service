import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';

interface AuthenticatedUser {
  id?: string;
  tenantId?: string;
  outletId?: string;
}

@Injectable()
export class AccessLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    const requestId = request.header('x-request-id') ?? randomUUID();
    const correlationId = request.header('x-correlation-id') ?? requestId;
    const startedAt = Date.now();

    response.setHeader('x-request-id', requestId);
    response.setHeader('x-correlation-id', correlationId);

    response.on('finish', () => {
      const user = (request as unknown as { user?: AuthenticatedUser }).user;
      const durationMs = Date.now() - startedAt;

      const logPayload = {
        timestamp: new Date().toISOString(),
        level:
          response.statusCode >= 500
            ? 'ERROR'
            : response.statusCode >= 400
              ? 'WARN'
              : 'INFO',
        requestId,
        correlationId,
        tenantId: user?.tenantId ?? null,
        outletId: user?.outletId ?? null,
        userId: user?.id ?? null,
        method: request.method,
        url: request.originalUrl,
        statusCode: response.statusCode,
        durationMs,
        ip: request.ip,
      };

      this.logger.log(JSON.stringify(logPayload));
    });

    return next.handle();
  }
}
