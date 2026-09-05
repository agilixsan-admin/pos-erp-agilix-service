export interface IStorageDriver {
  uploadFile(
    filePath: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<string>;
  deleteFile(filePath: string): Promise<void>;
  getFileUrl(filePath: string): string;
  getPresignedUrl?(
    filePath: string,
    expiresInSeconds?: number,
  ): Promise<string>;
}
