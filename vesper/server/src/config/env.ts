import 'dotenv/config';
import { z } from 'zod';

const emptyToUndef = (v: unknown) => (v === '' ? undefined : v);

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  CLIENT_URL: z.string().default('http://localhost:5173'),
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  APP_SECRET: z.string().min(32, 'APP_SECRET must be at least 32 characters'),
  ENCRYPTION_KEY: z
    .string()
    .refine((v) => Buffer.from(v, 'base64').length === 32, 'ENCRYPTION_KEY must be 32 random bytes in base64'),
  REQUIRE_EMAIL_VERIFICATION: z.enum(['true', 'false']).default('true').transform((v) => v === 'true'),
  SMTP_HOST: z.preprocess(emptyToUndef, z.string().optional()),
  SMTP_PORT: z.preprocess(emptyToUndef, z.coerce.number().int().default(587)),
  SMTP_USER: z.preprocess(emptyToUndef, z.string().optional()),
  SMTP_PASS: z.preprocess(emptyToUndef, z.string().optional()),
  SMTP_FROM: z.string().default('Vesper <no-reply@localhost>'),
  UPLOAD_DIR: z.string().default('./uploads'),
  MAX_UPLOAD_MB: z.coerce.number().positive().default(10),
  LOG_DIR: z.string().default('../logs'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  LOG_MAX_SIZE: z.string().default('10M'),
  LOG_MAX_FILES: z.coerce.number().int().positive().default(14),
  COOKIE_SECURE: z.preprocess(emptyToUndef, z.enum(['true', 'false']).optional()),
  STATIC_DIR: z.string().default('../web/dist'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('\n✖ Некорректная конфигурация (.env):');
  for (const i of parsed.error.issues) console.error(`  - ${i.path.join('.')}: ${i.message}`);
  console.error('\nСм. server/.env.example\n');
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';
export const cookieSecure = env.COOKIE_SECURE ? env.COOKIE_SECURE === 'true' : isProd;
export const clientOrigins = env.CLIENT_URL.split(',').map((s) => s.trim().replace(/\/$/, '')).filter(Boolean);
export const allowedOrigins = new Set(clientOrigins);
export const publicUrl = clientOrigins[0];
