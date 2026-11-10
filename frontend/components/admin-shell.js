import Link from 'next/link';
import { AdminNav } from './admin-nav';
import { LogoutButton } from './logout-button';
import { PageTransition } from './page-transition';

export function AdminShell({ user, children }) {
  return (
    <div className="min-h-screen bg-surface grid grid-cols-1 lg:grid-cols-[16rem_1fr]">
      <aside className="border-b lg:border-b-0 lg:border-r border-fillet px-6 py-8 space-y-8">
        <div>
          <p className="font-display tracking-[0.16em] uppercase">Maison d&apos;Art</p>
          <p className="label-sm text-patina mt-2">Curatorial console</p>
        </div>
        <AdminNav />
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
