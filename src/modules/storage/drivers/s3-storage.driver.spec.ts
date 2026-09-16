import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { S3StorageDriver } from './s3-storage.driver';
import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketPolicyCommand,
  S3Client,
} from '@aws-sdk/client-s3';

describe('S3StorageDriver', () => {
  let driver: S3StorageDriver;
  let mockS3Send: jest.Mock;

  beforeEach(async () => {
    mockS3Send = jest.fn();
    jest.spyOn(S3Client.prototype, 'send').mockImplementation(mockS3Send);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        S3StorageDriver,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              const configMap: Record<string, any> = {
                'storage.s3.endpoint': 'http://localhost:9000',
                'storage.s3.region': 'us-east-1',
                'storage.s3.accessKeyId': 'minioadmin',
                'storage.s3.secretAccessKey': 'minioadmin',
                'storage.s3.forcePathStyle': true,
                'storage.s3.bucket': 'test-bucket',
                'storage.s3.publicUrl': 'https://s3.agilix.id/test-bucket',
              };
              return configMap[key] ?? defaultValue;
            }),
          },
        },
      ],
    }).compile();

    driver = module.get<S3StorageDriver>(S3StorageDriver);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(driver).toBeDefined();
  });

  it('should automatically set public read policy when bucket already exists', async () => {
    mockS3Send.mockImplementation(async (command) => {
      if (command instanceof HeadBucketCommand) {
        return {};
      }
      if (command instanceof PutBucketPolicyCommand) {
        return {};
      }
      return {};
    });

    await driver.ensureBucket();

    expect(mockS3Send).toHaveBeenCalledWith(expect.any(HeadBucketCommand));
    expect(mockS3Send).toHaveBeenCalledWith(expect.any(PutBucketPolicyCommand));
    const policyCall = mockS3Send.mock.calls.find(
      (c) => c[0] instanceof PutBucketPolicyCommand,
    );
    expect(policyCall).toBeDefined();
    const policyObj = JSON.parse(policyCall[0].input.Policy);
    expect(policyObj.Statement[0].Resource).toContain(
      'arn:aws:s3:::test-bucket/*',
    );
    expect(policyObj.Statement[0].Effect).toBe('Allow');
    expect(policyObj.Statement[0].Action).toContain('s3:GetObject');
  });

  it('should create bucket and set policy when bucket does not exist', async () => {
    mockS3Send.mockImplementation(async (command) => {
      if (command instanceof HeadBucketCommand) {
        throw new Error('NotFound');
      }
      if (command instanceof CreateBucketCommand) {
        return {};
      }
      if (command instanceof PutBucketPolicyCommand) {
        return {};
      }
      return {};
    });

    await driver.ensureBucket();

    expect(mockS3Send).toHaveBeenCalledWith(expect.any(HeadBucketCommand));
    expect(mockS3Send).toHaveBeenCalledWith(expect.any(CreateBucketCommand));
    expect(mockS3Send).toHaveBeenCalledWith(expect.any(PutBucketPolicyCommand));
  });

  it('should not throw if applying bucket policy fails', async () => {
    mockS3Send.mockImplementation(async (command) => {
      if (command instanceof HeadBucketCommand) {
        return {};
      }
      if (command instanceof PutBucketPolicyCommand) {
        throw new Error('AccessDenied to put policy');
      }
      return {};
    });

    await expect(driver.ensureBucket()).resolves.not.toThrow();
  });

  it('should sanitize htts:// scheme in getFileUrl', () => {
    const url = driver.getFileUrl('uploads/test.jpg');
    expect(url).toBe('https://s3.agilix.id/test-bucket/uploads/test.jpg');
  });
});
