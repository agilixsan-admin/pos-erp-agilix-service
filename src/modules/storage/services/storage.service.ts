import { Inject, Injectable, Logger } from '@nestjs/common';
import type { IStorageDriver } from '../interfaces/storage-driver.interface';
import { ImageProcessorService } from './image-processor.service';

export const STORAGE_DRIVER = 'STORAGE_DRIVER';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  constructor(
    @Inject(STORAGE_DRIVER)
    private readonly driver: IStorageDriver,
    private readonly imageProcessor: ImageProcessorService,
  ) {}

  async uploadProductImage(
    tenantId: string,
    productId: string,
    file: Express.Multer.File,
  ): Promise<string> {
    this.imageProcessor.validateImage(file);
    const processed = await this.imageProcessor.convertToWebp(file.buffer);

    const filename = `${productId}_${Date.now()}${processed.extension}`;
    const filePath = `uploads/${tenantId}/products/${filename}`;

    return this.driver.uploadFile(
      filePath,
      processed.buffer,
      processed.contentType,
    );
  }

  async deleteProductImage(
    tenantId: string,
    imageUrl: string | null | undefined,
  ): Promise<void> {
    if (!imageUrl) return;

    try {
      const tenantPrefix = `uploads/${tenantId}/`;
      const prefixIndex = imageUrl.indexOf(tenantPrefix);

      if (prefixIndex === -1) {
        this.logger.warn(
          `Skipping deletion of image outside tenant scope: ${imageUrl}`,
        );
        return;
      }

      const filePath = imageUrl.substring(prefixIndex);
      await this.driver.deleteFile(filePath);
    } catch (err: unknown) {
      this.logger.warn(
        `Failed to delete old product image (${imageUrl}): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}
