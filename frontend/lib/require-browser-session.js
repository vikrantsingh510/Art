import { isSupabaseConfigured } from './env';
import { createBrowserSupabaseClient } from './supabase/browser';
import { wishlistLoginPath } from './wishlist-favourite';

export async function requireSession(router, nextPath) {
  if (!isSupabaseConfigured()) {
    throw new Error('Authentication is not configured in this environment.');
  }
  const supabase = createBrowserSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    router.push(wishlistLoginPath(nextPath));
    return null;
  }
  return session;
}
