'use client';

import { createBrowserClient } from '@supabase/ssr';
import { getSupabasePublishableKey, getSupabaseUrl, isSupabaseConfigured } from '../env';

export function createBrowserSupabaseClient() {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase browser environment is not configured.');
  }

  return createBrowserClient(getSupabaseUrl(), getSupabasePublishableKey());
}
