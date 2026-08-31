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

@Injectable()
export class AccessLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const requestId = request.header('x-request-id') ?? randomUUID();
    const startedAt = Date.now();

    response.setHeader('x-request-id', requestId);

    response.on('finish', () => {
      this.logger.log(
        `${request.method} ${request.originalUrl} ${response.statusCode} ${Date.now() - startedAt}ms requestId=${requestId}`,
      );
    });

    return next.handle();
  }
}
