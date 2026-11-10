import pino from 'pino';
import { env } from './env.js';

const SECRET_PATTERN = /postgres(?:ql)?:\/\/[^\s"'`]+/gi;

export function toSafeErrorLog(error) {
  return {
    name: error?.name,
    code: error?.code,
    message: String(error?.message ?? 'Unknown error').replace(SECRET_PATTERN, 'postgresql://***'),
  };
}

function resolveLogLevel() {
  if (env.NODE_ENV === 'test') {
    return 'silent';
  }

  return env.NODE_ENV === 'production' ? 'info' : 'debug';
}

export const logger = pino({
  level: resolveLogLevel(),
  redact: {
    paths: [
      'DATABASE_URL',
      'MIGRATION_DATABASE_URL',
      'SUPABASE_PUBLISHABLE_KEY',
      'RAZORPAY_KEY_SECRET',
      'RAZORPAY_WEBHOOK_SECRET',
      'req.headers.authorization',
      'req.headers.cookie',
      'recipientEmail',
      'email',
      'to',
    ],
    censor: '[Redacted]',
  },
});

export default logger;
