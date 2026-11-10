'use client';

import { createArtApi } from './api-client';
import { getApiBaseUrl, isSupabaseConfigured } from './env';
import { createBrowserSupabaseClient } from './supabase/browser';

export async function getBrowserAccessToken() {
  if (!isSupabaseConfigured()) {
    return null;
  }
  const supabase = createBrowserSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
}

export async function createBrowserArtApi() {
  const token = await getBrowserAccessToken();
  return createArtApi({
    baseUrl: getApiBaseUrl(),
    getAccessToken: async () => token,
  });
}
