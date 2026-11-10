import Link from 'next/link';
import { IconBag, IconHeart, IconSearch } from './icons';
import { MobileNav } from './mobile-nav';

const nav = [
  { href: '/', label: 'Exhibition' },
  { href: '/explore', label: 'Explore Art' },
  { href: '/collections', label: 'Collections' },
  { href: '/about', label: 'Our Philosophy' },
  { href: '/contact', label: 'Provenance' },
];

export function SiteHeader({ user, cartCount = 0, wishlistCount = 0 }) {
  return (
    <header className="site-header fixed top-0 left-0 right-0 z-50 bg-surface/95 backdrop-blur-md">
      <div className="bg-surface-container-low px-4 md:px-8 py-2 flex items-center justify-center">
        <p className="label-sm text-on-surface-variant text-center tracking-[0.2em]">
          100% Authentic Handmade Originals • Verified Provenance &amp; Certificates • White-Glove Architectural Delivery Across India
        </p>
      </div>
      <div className="relative h-20 max-w-7xl mx-auto px-6 md:px-16 flex items-center justify-between gap-6">
        <div className="flex items-center gap-3 shrink-0">
          <Link href="/" className="font-display text-[22px] tracking-[0.18em] uppercase text-primary">
            Maison d&apos;Art
          </Link>
        </div>
        <nav className="hidden xl:flex items-center gap-8">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} className="label-md text-on-surface-variant hover:text-on-surface">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-5 shrink-0">
          <Link href="/explore" aria-label="Search archive" className="text-on-surface-variant hover:text-on-surface">
            <IconSearch />
          </Link>
          <span className="hidden sm:inline label-sm text-on-surface-variant">INR (₹)</span>
          <Link href="/account/wishlist" aria-label="Saved works" className="relative text-on-surface-variant hover:text-on-surface">
            <IconHeart />
            {wishlistCount > 0 ? <span className="absolute -top-2 -right-2 label-sm text-bronze">{wishlistCount}</span> : null}
          </Link>
          <Link href="/cart" aria-label="Acquisitions bag" className="relative text-on-surface-variant hover:text-on-surface">
            <IconBag />
            {cartCount > 0 ? <span className="absolute -top-2 -right-2 label-sm text-bronze">{cartCount}</span> : null}
          </Link>
          <div className="h-4 w-px bg-outline-variant hidden sm:block" />
          <Link href={user ? '/account' : '/auth/login'} className="hidden lg:inline label-sm text-on-surface-variant hover:text-primary">
            {user ? 'Dossier' : 'Sign in'}
          </Link>
          {user?.isAdmin ? (
            <Link href="/admin" className="hidden lg:inline label-sm text-bronze">
              Console
            </Link>
          ) : null}
          <MobileNav user={user} cartCount={cartCount} wishlistCount={wishlistCount} />
        </div>
      </div>
    </header>
  );
}
