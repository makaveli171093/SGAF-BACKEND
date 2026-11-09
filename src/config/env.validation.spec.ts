import { describe, it, expect } from 'vitest';
import { envValidationSchema } from './env.validation.js';
const schema = envValidationSchema.extract('CORS_ORIGINS');
describe('Orígenes del frontend', () => {
  it('acepta orígenes exactos de desarrollo y producción', () => {
    expect(
      schema.validate('http://localhost:5173, https://sgaf.vercel.app').error,
    ).toBeUndefined();
  });
  it.each([
    '*',
    'https://sgaf.vercel.app/ruta',
    'https://sgaf.vercel.app,',
    'javascript:alert(1)',
  ])('rechaza origen inválido %s', (value) =>
    expect(schema.validate(value).error).toBeDefined(),
  );
});
