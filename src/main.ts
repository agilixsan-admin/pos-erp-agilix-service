import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AccessLogInterceptor } from './common/interceptors/access-log.interceptor';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  // Security headers
  app.use(helmet());

  // CORS
  const corsOrigin = config.get<string>('cors') ?? '*';
  app.enableCors({
    origin: corsOrigin,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id'],
    exposedHeaders: ['x-request-id'],
  });

  // API versioning
  app.setGlobalPrefix('api/v1');

  // Access log
  app.useGlobalInterceptors(new AccessLogInterceptor());

  // Input validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = config.get<number>('port') ?? 3000;
  const dataSource = app.get(DataSource, { strict: false });
  if (dataSource?.isInitialized) {
    logger.log(
      `Database connected: ${config.get<string>('database.name')}@${config.get<string>('database.host')}:${config.get<number>('database.port')}`,
    );
  }

  await app.listen(port);
  logger.log(`Application running on http://localhost:${port}`);
}
void bootstrap();
