import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { IStorageDriver } from '../interfaces/storage-driver.interface';

@Injectable()
export class S3StorageDriver implements IStorageDriver, OnModuleInit {
  private readonly logger = new Logger(S3StorageDriver.name);
  private client: S3Client;
  private endpoint: string;
  private bucket: string;
  private publicUrl: string;

  constructor(private readonly config: ConfigService) {
    const endpoint = this.config.get<string>(
      'storage.s3.endpoint',
      'http://localhost:9000',
    );
    const region = this.config.get<string>('storage.s3.region', 'us-east-1');
    const accessKeyId = this.config.get<string>(
      'storage.s3.accessKeyId',
      'minioadmin',
    );
    const secretAccessKey = this.config.get<string>(
      'storage.s3.secretAccessKey',
      'minioadmin',
    );
    const forcePathStyle = this.config.get<boolean>(
      'storage.s3.forcePathStyle',
      true,
    );

    this.endpoint = endpoint;
    this.bucket = this.config.get<string>('storage.s3.bucket', 'aglix-pos');
    this.publicUrl = this.config.get<string>(
      'storage.s3.publicUrl',
      `${endpoint}/${this.bucket}`,
    );

    this.client = new S3Client({
      endpoint,
      region,
      forcePathStyle,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  async onModuleInit(): Promise<void> {
    await this.ensureBucket();
  }

  async ensureBucket(): Promise<void> {
    try {
      await this.client.send(
        new HeadBucketCommand({
          Bucket: this.bucket,
        }),
      );
      this.logger.log(
        `S3/MinIO Storage connected: Bucket "${this.bucket}" ready at ${this.endpoint}`,
      );
    } catch {
      try {
        await this.client.send(
          new CreateBucketCommand({
            Bucket: this.bucket,
          }),
        );
        this.logger.log(
          `S3/MinIO Storage connected: Bucket "${this.bucket}" created and ready at ${this.endpoint}`,
        );
      } catch (createErr: unknown) {
        this.logger.warn(
          `Could not connect to S3/MinIO bucket "${this.bucket}" at ${this.endpoint}: ${
            createErr instanceof Error ? createErr.message : String(createErr)
          }`,
        );
      }
    }
  }

  async uploadFile(
    filePath: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<string> {
    const cleanKey = filePath.startsWith('/') ? filePath.slice(1) : filePath;
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: cleanKey,
      Body: buffer,
      ContentType: contentType,
    });

    await this.client.send(command);
    return this.getFileUrl(cleanKey);
  }

  async deleteFile(filePath: string): Promise<void> {
    const cleanKey = filePath.startsWith('/') ? filePath.slice(1) : filePath;
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: cleanKey,
    });

    await this.client.send(command);
  }

  getFileUrl(filePath: string): string {
    const baseUrl = this.publicUrl.endsWith('/')
      ? this.publicUrl.slice(0, -1)
      : this.publicUrl;
    const cleanPath = filePath.startsWith('/') ? filePath.slice(1) : filePath;
    return `${baseUrl}/${cleanPath}`;
  }

  async getPresignedUrl(
    filePath: string,
    expiresInSeconds = 3600,
  ): Promise<string> {
    const cleanKey = filePath.startsWith('/') ? filePath.slice(1) : filePath;
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: cleanKey,
    });
    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }
}
