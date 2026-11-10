import Link from 'next/link';
import { LogoutButton } from './logout-button';
import { PageTransition } from './page-transition';

const links = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/artworks', label: 'Artwork collection' },
  { href: '/admin/artworks/new', label: 'Add new artwork' },
  { href: '/admin/orders', label: 'Orders' },
  { href: '/admin/customers', label: 'Customers' },
];

export function AdminShell({ user, children }) {
  return (
    <div className="min-h-screen bg-surface grid grid-cols-1 lg:grid-cols-[16rem_1fr]">
      <aside className="border-b lg:border-b-0 lg:border-r border-fillet px-6 py-8 space-y-8">
        <div>
          <p className="font-display tracking-[0.16em] uppercase">Maison d&apos;Art</p>
          <p className="label-sm text-patina mt-2">Curatorial console</p>
        </div>
        <nav className="space-y-3">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="block label-md text-on-surface-variant hover:text-primary">
              {link.label}
            </Link>
          ))}
        </nav>
        <p className="text-xs text-patina">Archival protocol: private lots stay path-only. No live dispatch or payment controls.</p>
        <Link href="/" className="text-link block">View salon</Link>
      </aside>
      <div>
        <header className="h-20 px-6 md:px-10 border-b border-fillet flex items-center justify-between gap-4">
          <p className="label-md text-patina">Salon curatorial portal — atelier-direct management</p>
          <div className="flex items-center gap-4">
            <span className="label-sm">{user.fullName || user.email}</span>
            <LogoutButton />
          </div>
        </header>
        <div className="px-6 md:px-10 py-10">
          <PageTransition>{children}</PageTransition>
        </div>
      </div>
    </div>
  );
}
