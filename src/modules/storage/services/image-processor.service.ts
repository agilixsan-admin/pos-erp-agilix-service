import { BadRequestException, Injectable } from '@nestjs/common';
import sharp from 'sharp';

export interface ProcessedImageResult {
  buffer: Buffer;
  contentType: string;
  extension: string;
  width?: number;
  height?: number;
}

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

@Injectable()
export class ImageProcessorService {
  validateImage(file: Express.Multer.File | undefined): void {
    if (!file || !file.buffer) {
      throw new BadRequestException({
        success: false,
        message: 'No file uploaded',
        code: 'FILE_REQUIRED',
      });
    }

    if (!ALLOWED_MIME_TYPES.has(file.mimetype.toLowerCase())) {
      throw new BadRequestException({
        success: false,
        message: 'Only image files (JPEG, PNG, WebP) are allowed',
        code: 'INVALID_FILE_TYPE',
      });
    }

    const originalName = file.originalname || '';
    const lastDotIndex = originalName.lastIndexOf('.');
    const extension =
      lastDotIndex !== -1 ? originalName.slice(lastDotIndex).toLowerCase() : '';

    if (!ALLOWED_EXTENSIONS.has(extension)) {
      throw new BadRequestException({
        success: false,
        message:
          'Invalid file extension. Only .jpg, .jpeg, .png, .webp allowed',
        code: 'INVALID_FILE_TYPE',
      });
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException({
        success: false,
        message: 'File size exceeds maximum limit of 5MB',
        code: 'FILE_TOO_LARGE',
      });
    }
  }

  async convertToWebp(buffer: Buffer): Promise<ProcessedImageResult> {
    try {
      const image = sharp(buffer);
      const metadata = await image.metadata();

      if (!metadata.format) {
        throw new BadRequestException({
          success: false,
          message: 'Uploaded file is not a valid or readable image',
          code: 'INVALID_IMAGE_DATA',
        });
      }

      const webpBuffer = await image
        .resize({
          width: 1200,
          height: 1200,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: 80 })
        .toBuffer();

      return {
        buffer: webpBuffer,
        contentType: 'image/webp',
        extension: '.webp',
        width: metadata.width,
        height: metadata.height,
      };
    } catch (err: unknown) {
      if (err instanceof BadRequestException) {
        throw err;
      }
      throw new BadRequestException({
        success: false,
        message: 'Failed to process image file. Ensure file is a valid image.',
        code: 'IMAGE_PROCESSING_FAILED',
      });
    }
  }
}
