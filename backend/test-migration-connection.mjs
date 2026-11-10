import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';
import postgres from 'postgres';

const envPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '.env');
loadDotenv({ path: envPath, quiet: true });

const migrationDatabaseUrl = typeof process.env.MIGRATION_DATABASE_URL === 'string'
  ? process.env.MIGRATION_DATABASE_URL.trim()
  : '';

if (!migrationDatabaseUrl) {
  console.error('FAIL: MIGRATION_DATABASE_URL is missing or empty.');
  process.exit(1);
}

function sanitizeMessage(message) {
  return String(message ?? '').replace(/postgres(?:ql)?:\/\/[^\s'"]+/gi, 'postgresql://***');
}

function printFailure(error) {
  console.error(`  name: ${error?.name ?? 'unknown'}`);
  console.error(`  code: ${error?.code ?? 'unknown'}`);
  console.error(`  message: ${sanitizeMessage(error?.message)}`);
}

async function testConnection(label, options) {
  let client;

  try {
    client = postgres(migrationDatabaseUrl, options);
    const rows = await client`SELECT 1 AS connection_test`;
    const ok = Array.isArray(rows) && Number(rows[0]?.connection_test) === 1;
    if (!ok) {
      throw new Error('SELECT 1 did not return connection_test = 1');
    }
    console.log(`${label}: PASS`);
  } catch (error) {
    console.log(`${label}: FAIL`);
    printFailure(error);
  } finally {
    if (client) {
      await client.end({ timeout: 5 });
    }
  }
}

await testConnection('Test A (max: 1)', { max: 1 });
await testConnection("Test B (max: 1, ssl: 'require')", { max: 1, ssl: 'require' });
