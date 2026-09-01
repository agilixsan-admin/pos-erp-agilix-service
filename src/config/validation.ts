import Joi from 'joi';

export const configurationValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  PORT: Joi.number().port().default(3000),
  CORS: Joi.string().default('*'),
  DB_HOST: Joi.string().default('localhost'),
  DB_PORT: Joi.number().port().default(5432),
  DB_USERNAME: Joi.string().default('postgres'),
  DB_PASSWORD: Joi.string().allow('').default(''),
  DB_NAME: Joi.string().default('aglix_pos'),
  DB_SSL: Joi.boolean().truthy('true').falsy('false').default(false),
  DB_LOGGING: Joi.boolean().truthy('true').falsy('false').default(false),
  JWT_SECRET: Joi.string()
    .min(32)
    .allow('')
    .when('NODE_ENV', { is: 'production', then: Joi.required() }),
  JWT_ACCESS_TOKEN_TTL: Joi.string().default('15m'),
  JWT_EXPIRES_IN: Joi.string().optional(),
  JWT_REFRESH_SECRET: Joi.string().optional().allow(''),
  JWT_REFRESH_EXPIRES_IN: Joi.string().optional(),
  CONSOLE_API_KEY: Joi.string()
    .min(1)
    .allow('')
    .when('NODE_ENV', { is: 'production', then: Joi.required() }),
  THROTTLE_TTL: Joi.number().default(60000),
  THROTTLE_LIMIT: Joi.number().default(120),
}).unknown(true);
