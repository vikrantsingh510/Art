import { cache } from 'react';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { api, ApiClientError } from './api';
import { readCurrentUser } from './current-user';
import { canAccessAdmin } from './guards';
import { createServerSupabaseClient } from './supabase/server';

export async function getAccessToken() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return null;
  }

  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

export const getCurrentUser = cache(function getCurrentUser() {
  return readCurrentUser({
    getAccessToken,
    getMe: (options) => api.getMe(options),
  });
});

function loginPath(nextPath) {
  const next = nextPath && nextPath !== '/auth/login' ? nextPath : '/account';
  return `/auth/login?next=${encodeURIComponent(next)}`;
}

export async function requireUser() {
  const headerStore = await headers();
  const nextPath = headerStore.get('x-pathname') || '/account';
  const current = await getCurrentUser();
  if (current.unavailable === 'rate_limited') {
    throw current.error;
  }
  if (!current.user || !current.token) {
    redirect(loginPath(nextPath));
  }
  return { user: current.user, token: current.token };
}

export async function requireAdmin() {
  const { user, token } = await requireUser();
  if (!canAccessAdmin(user)) {
    redirect('/forbidden');
  }
  return { user, token };
}

export function isRateLimitError(error) {
  return error instanceof ApiClientError && error.status === 429;
}
