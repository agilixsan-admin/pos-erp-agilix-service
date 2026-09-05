import { BadRequestException } from '@nestjs/common';
import sharp from 'sharp';
import { ImageProcessorService } from './image-processor.service';

describe('ImageProcessorService', () => {
  let service: ImageProcessorService;

  beforeEach(() => {
    service = new ImageProcessorService();
  });

  describe('validateImage', () => {
    it('throws BadRequestException if no file is provided', () => {
      expect(() => service.validateImage(undefined)).toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException for disallowed mime type (e.g. application/pdf)', () => {
      const file = {
        buffer: Buffer.from('test'),
        mimetype: 'application/pdf',
        originalname: 'test.pdf',
        size: 1000,
      } as Express.Multer.File;

      expect(() => service.validateImage(file)).toThrow(BadRequestException);
    });

    it('throws BadRequestException for disallowed extension even with image mime type', () => {
      const file = {
        buffer: Buffer.from('test'),
        mimetype: 'image/jpeg',
        originalname: 'script.exe',
        size: 1000,
      } as Express.Multer.File;

      expect(() => service.validateImage(file)).toThrow(BadRequestException);
    });

    it('throws BadRequestException if file exceeds 5MB', () => {
      const file = {
        buffer: Buffer.from('test'),
        mimetype: 'image/png',
        originalname: 'photo.png',
        size: 6 * 1024 * 1024,
      } as Express.Multer.File;

      expect(() => service.validateImage(file)).toThrow(BadRequestException);
    });

    it('passes validation for valid JPEG, PNG, or WebP files', () => {
      const validFile = {
        buffer: Buffer.from('test'),
        mimetype: 'image/png',
        originalname: 'product-photo.png',
        size: 1024,
      } as Express.Multer.File;

      expect(() => service.validateImage(validFile)).not.toThrow();
    });
  });

  describe('convertToWebp', () => {
    it('converts a valid image buffer into webp format', async () => {
      const pngBuffer = await sharp({
        create: {
          width: 10,
          height: 10,
          channels: 4,
          background: { r: 255, g: 0, b: 0, alpha: 1 },
        },
      })
        .png()
        .toBuffer();

      const result = await service.convertToWebp(pngBuffer);

      expect(result.contentType).toBe('image/webp');
      expect(result.extension).toBe('.webp');
      expect(result.buffer).toBeInstanceOf(Buffer);

      const metadata = await sharp(result.buffer).metadata();
      expect(metadata.format).toBe('webp');
      expect(metadata.width).toBe(10);
      expect(metadata.height).toBe(10);
    });

    it('throws BadRequestException when buffer is corrupted or not an image', async () => {
      const corruptedBuffer = Buffer.from('not an image data string');

      await expect(service.convertToWebp(corruptedBuffer)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
