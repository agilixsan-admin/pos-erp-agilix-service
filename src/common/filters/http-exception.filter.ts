import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const status =
      exception instanceof HttpException ? exception.getStatus() : 500;
    const details =
      exception instanceof HttpException ? exception.getResponse() : null;
    const body = typeof details === 'object' && details !== null ? details : {};
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
