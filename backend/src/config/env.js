import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

const envFilePath = process.env.DOTENV_PATH
  ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../.env');

loadDotenv({ path: envFilePath, quiet: true });

/**
 * Express validates DATABASE_URL only. MIGRATION_DATABASE_URL is required by
 * drizzle.config.js for Kit commands and must not be required for API startup.
 */

const SENSITIVE_FIELDS = new Set([
  'DATABASE_URL',
  'MIGRATION_DATABASE_URL',
  'SUPABASE_PUBLISHABLE_KEY',
  'RAZORPAY_KEY_SECRET',
  'RAZORPAY_WEBHOOK_SECRET',
]);

const optionalSecret = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().min(1).optional(),
);

const requiredString = (message) => z
  .string({ error: message })
  .trim()
  .min(1, { error: message });

const httpUrl = (requiredMessage, invalidMessage) => requiredString(requiredMessage).pipe(
  z.url({
    protocol: /^https?$/,
    error: invalidMessage,
  }),
);

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test'], {
    error: 'NODE_ENV must be one of: development, production, test',
  }),
  PORT: z.coerce
    .number({ error: 'PORT must be a valid integer between 1 and 65535' })
    .int({ error: 'PORT must be a valid integer between 1 and 65535' })
    .min(1, { error: 'PORT must be a valid integer between 1 and 65535' })
    .max(65535, { error: 'PORT must be a valid integer between 1 and 65535' }),
  FRONTEND_URL: httpUrl(
    'FRONTEND_URL is required',
    'FRONTEND_URL must be a valid URL',
  ),
  DATABASE_URL: requiredString('DATABASE_URL is required').pipe(
    z.url({
      protocol: /^postgres(ql)?$/,
      error: 'DATABASE_URL must be a valid PostgreSQL connection URL',
    }),
  ),
  SUPABASE_URL: httpUrl(
    'SUPABASE_URL is required',
    'SUPABASE_URL must be a valid URL',
  ),
  SUPABASE_PUBLISHABLE_KEY: requiredString('SUPABASE_PUBLISHABLE_KEY is required')
    .startsWith('sb_publishable_', {
      error: 'SUPABASE_PUBLISHABLE_KEY must start with sb_publishable_',
    })
    .refine((value) => value.length > 'sb_publishable_'.length, {
      error: 'SUPABASE_PUBLISHABLE_KEY must start with sb_publishable_',
    }),
  RESERVATION_TTL_SECONDS: z.preprocess(
    (value) => (value === undefined || value === '' ? 900 : value),
    z.coerce.number().int().positive().max(86_400),
  ),
  RAZORPAY_KEY_ID: optionalSecret,
  RAZORPAY_KEY_SECRET: optionalSecret,
  RAZORPAY_WEBHOOK_SECRET: optionalSecret,
  TRUST_PROXY: z.preprocess(
    (value) => (value === undefined || value === '' ? 0 : value),
    z.coerce.number().int().min(0).max(5),
  ),
});

function formatEnvError(zodError) {
  const details = zodError.issues.map((issue) => {
    const field = issue.path.map(String).join('.') || 'environment';
    return `  - ${field}: ${sanitizeMessage(field, issue)}`;
  });

  return `Invalid environment configuration:\n${details.join('\n')}`;
}

function isMissingValue(issue) {
  return issue.code === 'invalid_type'
    || issue.code === 'too_small'
    || issue.input === '';
}

function sanitizeMessage(field, issue) {
  const missing = isMissingValue(issue);
  const fallback = missing ? `${field} is required` : `${field} is invalid`;
  const message = typeof issue.message === 'string' ? issue.message : '';
  const received = issue.input;
  const messageLeaksValue = typeof received === 'string'
    && received.length > 0
    && message.includes(received);

  if (SENSITIVE_FIELDS.has(field)) {
    if (missing) {
      return fallback;
    }

    if (message && !messageLeaksValue) {
      return message;
    }

    return fallback;
  }

  return message && !messageLeaksValue ? message : fallback;
}

export function loadEnv(source = process.env) {
  const result = envSchema.safeParse(source);

  if (!result.success) {
    throw new Error(formatEnvError(result.error));
  }

  return Object.freeze({
    NODE_ENV: result.data.NODE_ENV,
    PORT: result.data.PORT,
    FRONTEND_URL: result.data.FRONTEND_URL,
    DATABASE_URL: result.data.DATABASE_URL,
    SUPABASE_URL: result.data.SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY: result.data.SUPABASE_PUBLISHABLE_KEY,
    RESERVATION_TTL_SECONDS: result.data.RESERVATION_TTL_SECONDS,
    RAZORPAY_KEY_ID: result.data.RAZORPAY_KEY_ID,
    RAZORPAY_KEY_SECRET: result.data.RAZORPAY_KEY_SECRET,
    RAZORPAY_WEBHOOK_SECRET: result.data.RAZORPAY_WEBHOOK_SECRET,
    TRUST_PROXY: result.data.TRUST_PROXY,
  });
}

export const env = loadEnv();
export default env;
