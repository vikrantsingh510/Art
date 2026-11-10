import { PageTransition } from '@/components/page-transition';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { api } from '@/lib/api';
import { getCurrentUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function GalleryLayout({ children }) {
  let user = null;
  let token = null;
  let cartCount = 0;
  let wishlistCount = 0;
  try {
    const current = await getCurrentUser();
    user = current.user;
    token = current.token;
  } catch {
    user = null;
  }

  if (user && token) {
    try {
      const [cart, wishlist] = await Promise.all([
        api.getCart({ token }),
        api.getWishlist({ token }),
      ]);
      cartCount = cart?.count ?? cart?.items?.length ?? 0;
      wishlistCount = wishlist?.count ?? wishlist?.items?.length ?? 0;
    } catch {
      cartCount = 0;
      wishlistCount = 0;
    }
  }

  return (
    <>
      <SiteHeader user={user} cartCount={cartCount} wishlistCount={wishlistCount} />
      <main className="min-h-screen pt-[7.5rem] bg-surface">
        <PageTransition>{children}</PageTransition>
      </main>
      <SiteFooter />
    </>
  );
}
