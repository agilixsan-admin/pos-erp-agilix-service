import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ALL_MIGRATIONS } from './migrations';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        host: config.get<string>('database.host'),
        port: config.get<number>('database.port'),
        username: config.get<string>('database.username'),
        password: config.get<string>('database.password'),
        database: config.get<string>('database.name'),
        ssl: config.get<boolean>('database.ssl'),
        logging: config.get<boolean>('database.logging'),
        autoLoadEntities: true,
        migrations: ALL_MIGRATIONS,
        migrationsRun:
          config.get<string>('nodeEnv') !== 'production' ||
          process.env.DB_MIGRATIONS_RUN === 'true',
        synchronize: false,
      }),
    }),
  ],
})
export class DatabaseModule {}
