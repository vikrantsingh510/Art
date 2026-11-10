export function getApiBaseUrl() {
  return (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000')
    .replace(/\/$/, '')
    .replace(/\/api\/v1$/i, '');
}

export function getSupabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || '';
}

export function getSupabasePublishableKey() {
  return process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';
}

export function isSupabaseConfigured() {
  const url = getSupabaseUrl();
  const key = getSupabasePublishableKey();
  return Boolean(url && key && key.startsWith('sb_publishable_'));
}
