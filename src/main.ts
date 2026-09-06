import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DataSource } from 'typeorm';
import { join } from 'path';
import * as fs from 'fs';
import helmet from 'helmet';
import * as swaggerUi from 'swagger-ui-express';
import * as express from 'express';
import { AppModule } from './app.module';
import { AccessLogInterceptor } from './common/interceptors/access-log.interceptor';
import { ensureDatabaseExists } from './database/ensure-database';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // Auto-verify/create database if missing (Dev/Staging only, manual in Production)
  await ensureDatabaseExists(logger);

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);

  // Security headers
  app.use(helmet());

  // Request body size limit — prevent large payload attacks
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ limit: '1mb', extended: true }));

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

  // Swagger UI — only enabled when SWAGGER=development or SWAGGER=staging
  const swaggerEnv = config.get<string>('swagger');
  if (swaggerEnv === 'development' || swaggerEnv === 'staging') {
    const swaggerFile =
      swaggerEnv === 'staging' ? 'swaggerStaging.json' : 'swagger.json';

    const swaggerDocPath = join(
      process.cwd(),
      'documentation',
      'web',
      swaggerFile,
    );

    if (fs.existsSync(swaggerDocPath)) {
      const swaggerDocument = JSON.parse(
        fs.readFileSync(swaggerDocPath, 'utf8'),
      ) as Record<string, unknown>;

      // Merge all path/*.json files into the base swagger document
      const pathDir = join(process.cwd(), 'documentation', 'web', 'path');
      if (fs.existsSync(pathDir)) {
        const pathFiles = fs
          .readdirSync(pathDir)
          .filter((f) => f.endsWith('.json'));
        const mergedPaths: Record<string, unknown> = {};
        for (const file of pathFiles) {
          const content = JSON.parse(
            fs.readFileSync(join(pathDir, file), 'utf8'),
          ) as { paths?: Record<string, unknown> };
          if (content.paths) {
            Object.assign(mergedPaths, content.paths);
          }
        }
        swaggerDocument['paths'] = mergedPaths;
      }

      app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

      const port = config.get<number>('port') ?? 3000;
      logger.log(`Swagger UI available at http://localhost:${port}/api-docs`);
    }
  }

  const port = config.get<number>('port') ?? 3000;
  const nodeEnv = config.get<string>('nodeEnv', 'development');
  const dbHost = config.get<string>('database.host', 'localhost');
  const dbPort = config.get<number>('database.port', 5432);
  const dbName = config.get<string>('database.name', 'aglix_pos');
  const storageDriver = config.get<string>('storage.driver', 's3');
  const storageEndpoint = config.get<string>(
    'storage.s3.endpoint',
    'http://localhost:9000',
  );
  const storageBucket = config.get<string>('storage.s3.bucket', 'aglix-pos');
  const qrisProvider = config.get<string>('payment.qrisProvider', 'mock');
  const dataSource = app.get(DataSource, { strict: false });

  await app.listen(port);

  logger.log(
    '================================================================',
  );
  logger.log(`  Agilix POS Backend Service [${nodeEnv.toUpperCase()}]`);
  logger.log(
    '================================================================',
  );
  if (dataSource?.isInitialized) {
    logger.log(
      `  [Database]  CONNECTED -> PostgreSQL: ${dbName} (${dbHost}:${dbPort})`,
    );
  } else {
    logger.warn(`  [Database]  NOT CONNECTED or DataSource uninitialized`);
  }
  logger.log(
    `  [Storage]   ${storageDriver.toUpperCase()} (MinIO/S3) -> ${storageEndpoint}`,
  );
  logger.log(`              Target Bucket : "${storageBucket}"`);
  logger.log(
    `  [Payment]   Dynamic QRIS Provider : ${qrisProvider.toUpperCase()}`,
  );
  logger.log(`  [API Base]  http://localhost:${port}/api/v1`);
  if (swaggerEnv === 'development' || swaggerEnv === 'staging') {
    logger.log(`  [Swagger]   http://localhost:${port}/api-docs`);
  }
  logger.log(
    '================================================================',
  );
}
void bootstrap();
