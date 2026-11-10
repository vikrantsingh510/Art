import Link from 'next/link';
import { LogoutButton } from '@/components/logout-button';
import { requireUser } from '@/lib/session';

const links = [
  { href: '/account', label: 'Overview' },
  { href: '/account/profile', label: 'Profile' },
  { href: '/account/addresses', label: 'Addresses' },
  { href: '/account/wishlist', label: 'Wishlist' },
  { href: '/cart', label: 'Bag' },
  { href: '/account/orders', label: 'Orders' },
];

export default async function AccountLayout({ children }) {
  const { user } = await requireUser();

  return (
    <div className="max-w-7xl mx-auto px-6 md:px-16 py-12 grid grid-cols-1 lg:grid-cols-12 gap-12">
      <aside className="lg:col-span-3 space-y-6">
        <div>
          <p className="label-sm text-patina">Collector dossier</p>
          <p className="font-display text-2xl mt-2">{user.fullName || user.email}</p>
        </div>
        <nav className="space-y-3">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="block label-md text-on-surface-variant hover:text-primary">
              {link.label}
            </Link>
          ))}
        </nav>
        <LogoutButton />
      </aside>
      <div className="lg:col-span-9">{children}</div>
    </div>
  );
}
