import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { AppModule } from './app.module';
import { AccessLogInterceptor } from './common/interceptors/access-log.interceptor';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  app.setGlobalPrefix('api/v1');
  app.useGlobalInterceptors(new AccessLogInterceptor());
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
