import Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),

  PORT: Joi.number().port().default(3000),

  DATABASE_URL: Joi.string().required(),

  JWT_SECRET: Joi.string().min(16).required(),

  JWT_EXPIRES_IN: Joi.string().default('1d'),

  MOCKPAY_API_URL: Joi.string().uri().required(),

  MOCKPAY_SECRET_KEY: Joi.string().required(),

  MOCKPAY_CURRENCY: Joi.string().length(3).default('USD'),

  MOCKPAY_WEBHOOK_SECRET: Joi.string().required(),

  APP_BASE_URL: Joi.string().uri().required(),
});
