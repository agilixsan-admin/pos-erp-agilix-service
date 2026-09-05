import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { S3StorageDriver } from './drivers/s3-storage.driver';
import { ImageProcessorService } from './services/image-processor.service';
import { STORAGE_DRIVER, StorageService } from './services/storage.service';

@Module({
  imports: [ConfigModule],
  providers: [
    ImageProcessorService,
    S3StorageDriver,
    {
      provide: STORAGE_DRIVER,
      useExisting: S3StorageDriver,
    },
    StorageService,
  ],

  exports: [StorageService, ImageProcessorService],
})
export class StorageModule {}
