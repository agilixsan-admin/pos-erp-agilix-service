import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DataSource } from 'typeorm';
import { join } from 'path';
import * as fs from 'fs';
import helmet from 'helmet';
import * as swaggerUi from 'swagger-ui-express';
import { AppModule } from './app.module';
import { AccessLogInterceptor } from './common/interceptors/access-log.interceptor';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
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
