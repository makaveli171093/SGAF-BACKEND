import Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),

  PORT: Joi.number().port().default(3000),

  CORS_ORIGINS: Joi.string()
    .custom((value: string, helpers) => {
      const origins = value.split(',').map((origin) => origin.trim());
      try {
        if (
          origins.some((origin) => {
            const url = new URL(origin);
            return (
              !['http:', 'https:'].includes(url.protocol) ||
              url.origin !== origin
            );
          })
        )
          return helpers.error('any.invalid');
      } catch {
        return helpers.error('any.invalid');
      }
      return value;
    })
    .default('http://localhost:5173'),

  DATABASE_URL: Joi.string().required(),

  JWT_SECRET: Joi.string().min(16).required(),

  JWT_EXPIRES_IN: Joi.string().default('1d'),

  MOCKPAY_API_URL: Joi.string().uri().required(),

  MOCKPAY_SECRET_KEY: Joi.string().required(),

  MOCKPAY_CURRENCY: Joi.string().length(3).default('USD'),

  MOCKPAY_WEBHOOK_SECRET: Joi.string().required(),

  APP_BASE_URL: Joi.string().uri().required(),
});
