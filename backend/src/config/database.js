import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { env } from './env.js';
import * as schema from '../db/schema/index.js';

/**
 * Express uses DATABASE_URL only. After `0005_security_hardening` is applied
 * and `maison_app` is given LOGIN, runtime must connect as `maison_app`, not
 * as `postgres`, `service_role`, or `supabase_admin`. Drizzle Kit reads
 * `MIGRATION_DATABASE_URL` from `drizzle.config.js` and does not use this client.
 */

const isProduction = env.NODE_ENV === 'production';

function isLocalDatabaseHost(databaseUrl) {
  const { hostname } = new URL(databaseUrl);
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

export const client = postgres(env.DATABASE_URL, {
  max: isProduction ? 10 : 5,
  min: env.NODE_ENV === 'test' ? 0 : 1,
  idle_timeout: 20,
  connect_timeout: 10,
  max_lifetime: 60 * 30,
  keep_alive: 60,
  prepare: false,
  ssl: isLocalDatabaseHost(env.DATABASE_URL) ? false : 'require',
  connection: {
    application_name: 'maison-d-art-api',
  },
  onnotice: false,
});

export const db = drizzle(client, { schema });

let closingPromise;

export async function closeDatabase() {
  if (!closingPromise) {
    closingPromise = client.end({ timeout: 5 });
  }

  await closingPromise;
}

export default db;
