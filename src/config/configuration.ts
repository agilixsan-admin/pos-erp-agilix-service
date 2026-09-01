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
});
