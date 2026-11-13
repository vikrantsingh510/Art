import { PageTransition } from '@/components/page-transition';
import { ErrorState } from '@/components/states';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { loadCart, loadWishlist } from '@/lib/gallery-entity-loaders';
import { getCurrentUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function GalleryLayout({ children }) {
  let user = null;
  let token = null;
  let cartCount = 0;
  let wishlistCount = 0;
  let rateLimitError = null;
  let current = { user: null, token: null };
  try {
    current = await getCurrentUser();
  } catch {
    current = { user: null, token: null };
  }

  if (current.unavailable === 'rate_limited') {
    rateLimitError = current.error;
    user = current.token
      ? { id: 'signed-in', fullName: '', email: '', roles: [], isAdmin: false }
      : null;
  } else {
    user = current.user;
    token = current.token;
  }

  if (user && token) {
    try {
      const [cart, wishlist] = await Promise.all([
        loadCart(),
        loadWishlist(),
      ]);
      cartCount = cart?.count ?? cart?.items?.length ?? 0;
      wishlistCount = wishlist?.count ?? wishlist?.items?.length ?? 0;
    } catch (error) {
      if (error?.status === 429 && !rateLimitError) {
        rateLimitError = error;
      }
      cartCount = 0;
      wishlistCount = 0;
    }
  }

  return (
    <>
      <SiteHeader user={user} cartCount={cartCount} wishlistCount={wishlistCount} />
      <main className="min-h-screen pt-[7.5rem] bg-surface">
        {rateLimitError ? (
          <div className="page-shell pt-6">
            <ErrorState title="Too many requests" error={rateLimitError} retryHref="/" />
          </div>
        ) : null}
        <PageTransition>{children}</PageTransition>
      </main>
      <SiteFooter />
    </>
  );
}
