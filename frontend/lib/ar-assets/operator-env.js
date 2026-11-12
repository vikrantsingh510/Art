import fs from 'node:fs';
import path from 'node:path';
import { createSupabaseArStorage } from './storage-client.js';

function applyEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }
  const text = fs.readFileSync(filePath, 'utf8');
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }
    const eq = line.indexOf('=');
    if (eq <= 0) {
      continue;
    }
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

export function loadOperatorEnv() {
  const cwd = process.cwd();
  applyEnvFile(path.join(cwd, '.env'));
  applyEnvFile(path.join(cwd, '.env.local'));
  applyEnvFile(path.join(cwd, '..', 'backend', '.env'));
}

export function getOperatorStorageCredentials() {
  loadOperatorEnv();
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  return { supabaseUrl, serviceRoleKey };
}

export function createOperatorArStorage(bucket) {
  const credentials = getOperatorStorageCredentials();
  if (!credentials.supabaseUrl || !credentials.serviceRoleKey) {
    return {
      ok: false,
      status: 503,
      error: 'Server-side SUPABASE_SERVICE_ROLE_KEY is not configured. The browser never receives this key.',
    };
  }
  if (
    credentials.serviceRoleKey.startsWith('sb_publishable_')
    || credentials.serviceRoleKey.startsWith('NEXT_PUBLIC_')
  ) {
    return {
      ok: false,
      status: 503,
      error: 'Refusing to use a publishable browser key for AR Storage.',
    };
  }
  return {
    ok: true,
    storage: createSupabaseArStorage({
      supabaseUrl: credentials.supabaseUrl,
      serviceRoleKey: credentials.serviceRoleKey,
      bucket,
    }),
  };
}
