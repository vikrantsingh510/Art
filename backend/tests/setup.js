import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { after } from 'node:test';
import { config as loadDotenv } from 'dotenv';

loadDotenv({
  path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env'),
  quiet: true,
});

process.env.NODE_ENV = 'test';
process.env.PORT ||= '5000';
process.env.FRONTEND_URL ||= 'http://localhost:3000';
process.env.DATABASE_URL ||= 'postgresql://test:test@127.0.0.1:5432/postgres';
process.env.SUPABASE_URL ||= 'https://example.supabase.co';
process.env.SUPABASE_PUBLISHABLE_KEY ||= 'sb_publishable_test_key_value';

after(async () => {
  const { closeDatabase } = await import('../src/config/database.js');
  await closeDatabase();
});
