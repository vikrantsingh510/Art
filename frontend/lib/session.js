import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { api, ApiClientError } from './api';
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

export async function getCurrentUser() {
  const token = await getAccessToken();
  if (!token) {
    return { user: null, token: null };
  }

  try {
    const user = await api.getMe({ token });
    return { user, token };
  } catch (error) {
    if (error instanceof ApiClientError && (error.status === 401 || error.status === 403)) {
      return { user: null, token: null };
    }
    throw error;
  }
}

function loginPath(nextPath) {
  const next = nextPath && nextPath !== '/auth/login' ? nextPath : '/account';
  return `/auth/login?next=${encodeURIComponent(next)}`;
}

export async function requireUser() {
  const headerStore = await headers();
  const nextPath = headerStore.get('x-pathname') || '/account';
  const { user, token } = await getCurrentUser();
  if (!user || !token) {
    redirect(loginPath(nextPath));
  }
  return { user, token };
}

export async function requireAdmin() {
  const { user, token } = await requireUser();
  if (!canAccessAdmin(user)) {
    redirect('/forbidden');
  }
  return { user, token };
}
