/**
 * Production readiness checks. Does not deploy and does not print secrets.
 * Payments, shipping, and real email delivery are deferred for the current MVP.
 */
import { loadEnv } from '../src/config/env.js';

const failures = [];
const warnings = [];

function usernameFromDatabaseUrl(databaseUrl) {
  try {
    return decodeURIComponent(new URL(databaseUrl).username || '');
  } catch {
    return '';
  }
}

const env = loadEnv();

if (env.NODE_ENV !== 'production') {
  warnings.push('NODE_ENV is not production in the current process environment.');
}

const runtimeUser = usernameFromDatabaseUrl(env.DATABASE_URL);
if (runtimeUser === 'postgres' || runtimeUser.startsWith('postgres.')) {
  failures.push('DATABASE_URL still uses the postgres role. Restore maison_app before production.');
}

if (env.FRONTEND_URL.includes('localhost') && env.NODE_ENV === 'production') {
  failures.push('FRONTEND_URL still points at localhost. Set the production storefront origin for CORS.');
}

if (!process.env.MIGRATION_DATABASE_URL) {
  warnings.push('MIGRATION_DATABASE_URL is not set. Keep it separate from DATABASE_URL in production.');
} else {
  const migrationUser = usernameFromDatabaseUrl(process.env.MIGRATION_DATABASE_URL);
  if (migrationUser && runtimeUser && migrationUser === runtimeUser) {
    warnings.push('Runtime and migration database users are the same. Split them before production.');
  }
}

if (env.TRUST_PROXY === 0) {
  warnings.push('TRUST_PROXY is 0. Set TRUST_PROXY=1 when Express sits behind a reverse proxy so rate limiting sees client IPs.');
}

warnings.push('DEFERRED: Razorpay credentials are not required for the current MVP.');
warnings.push('DEFERRED: Real email delivery and custom domain are not required for the current MVP. Mock email remains active.');
warnings.push('DEFERRED: Shipping-provider credentials are not required for the current MVP.');

if (failures.length > 0) {
  console.error('Production environment check failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
}

if (warnings.length > 0) {
  console.log('Production environment warnings:');
  for (const warning of warnings) {
    console.log(`- ${warning}`);
  }
}

if (failures.length === 0) {
  console.log('Production environment required runtime fields are present.');
}

process.exit(failures.length > 0 ? 1 : 0);
