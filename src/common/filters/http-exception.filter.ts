import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

interface AuthenticatedUser {
  id?: string;
  tenantId?: string;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException ? exception.getStatus() : 500;
    const details =
      exception instanceof HttpException ? exception.getResponse() : null;
    const body = typeof details === 'object' && details !== null ? details : {};

    // Structured logging for server errors (5xx)
    if (status >= 500) {
      const requestId = request.header('x-request-id');
      const correlationId = request.header('x-correlation-id');
      const user = (request as unknown as { user?: AuthenticatedUser }).user;

      this.logger.error(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'ERROR',
          requestId: requestId ?? null,
          correlationId: correlationId ?? null,
          tenantId: user?.tenantId ?? null,
          userId: user?.id ?? null,
          method: request.method,
          url: request.originalUrl,
          statusCode: status,
          error:
            exception instanceof Error ? exception.message : String(exception),
          stack:
            process.env.NODE_ENV !== 'production' && exception instanceof Error
              ? exception.stack
              : undefined,
        }),
      );
    }

    response.status(status).json({
      success: false,
      message:
        typeof details === 'string'
          ? details
          : ((body as { message?: string }).message ?? 'Internal server error'),
      code:
        (body as { code?: string }).code ??
        (status === 500 ? 'INTERNAL_ERROR' : `HTTP_${status}`),
      ...(Array.isArray((body as { message?: unknown }).message)
        ? { errors: (body as { message: unknown }).message }
        : {}),
    });
  }
}
