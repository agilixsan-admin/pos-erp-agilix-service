export default () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3000),
  cors: process.env.CORS ?? '*',
  database: {
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    username: process.env.DB_USERNAME ?? 'postgres',
    password: process.env.DB_PASSWORD ?? '',
    name: process.env.DB_NAME ?? 'aglix_pos',
    defaultName: process.env.DB_DEFAULT_NAME ?? 'postgres',
    autoCreate: process.env.DB_AUTO_CREATE === 'false' ? false : true,
    ssl: process.env.DB_SSL === 'true',
    logging: process.env.DB_LOGGING === 'true',
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    accessTokenTtl:
      process.env.JWT_EXPIRES_IN ?? process.env.JWT_ACCESS_TOKEN_TTL ?? '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    refreshTokenTtl: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  },
  console: {
    apiKey: process.env.CONSOLE_API_KEY,
  },
  throttle: {
    ttl: Number(process.env.THROTTLE_TTL ?? 60000),
    limit: Number(process.env.THROTTLE_LIMIT ?? 120),
  },
  swagger: process.env.SWAGGER ?? '',
  storage: {
    driver: process.env.STORAGE_DRIVER ?? 's3',
    s3: {
      endpoint:
        process.env.S3_ENDPOINT ??
        (process.env.MINIO_ENDPOINT
          ? `http://${process.env.MINIO_ENDPOINT}:${process.env.MINIO_PORT ?? 9000}`
          : 'http://localhost:9000'),
      region: process.env.S3_REGION ?? 'us-east-1',
      accessKeyId:
        process.env.S3_ACCESS_KEY_ID ??
        process.env.MINIO_ACCESS_KEY ??
        'minioadmin',
      secretAccessKey:
        process.env.S3_SECRET_ACCESS_KEY ??
        process.env.MINIO_SECRET_KEY ??
        'minioadmin',
      bucket: process.env.S3_BUCKET ?? process.env.MINIO_BUCKET ?? 'aglix-pos',
      forcePathStyle:
        process.env.S3_FORCE_PATH_STYLE === 'false' ? false : true,
      publicUrl:
        process.env.S3_PUBLIC_URL ??
        process.env.MINIO_PUBLIC_URL ??
        'http://localhost:9000/aglix-pos',
    },
  },
  payment: {
    qrisProvider: process.env.QRIS_PROVIDER ?? 'mock',
    midtrans: {
      serverKey: process.env.MIDTRANS_SERVER_KEY ?? '',
      clientKey: process.env.MIDTRANS_CLIENT_KEY ?? '',
      isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
    },
  },
});
