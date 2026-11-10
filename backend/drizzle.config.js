import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

const envFilePath = process.env.DOTENV_PATH
  ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '.env');

loadDotenv({ path: envFilePath, quiet: true });

const migrationDatabaseUrl = typeof process.env.MIGRATION_DATABASE_URL === 'string'
  ? process.env.MIGRATION_DATABASE_URL.trim()
  : '';

if (!migrationDatabaseUrl) {
  throw new Error(
    'MIGRATION_DATABASE_URL is required for Drizzle Kit. Set it to a trusted migration administrator connection (direct Postgres, not the Express runtime role). Express startup does not use this variable.',
  );
}

let parsedMigrationUrl;

try {
  parsedMigrationUrl = new URL(migrationDatabaseUrl);
} catch {
  parsedMigrationUrl = null;
}

if (!parsedMigrationUrl || !/^postgres(ql)?:$/.test(parsedMigrationUrl.protocol)) {
  throw new Error(
    'MIGRATION_DATABASE_URL must be a valid PostgreSQL connection URL',
  );
}

parsedMigrationUrl.searchParams.set('sslmode', 'require');

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema/*.js',
  out: './src/db/migrations',
  dbCredentials: {
    url: parsedMigrationUrl.toString(),
  },
  verbose: false,
  strict: true,
});
