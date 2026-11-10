'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ACCOUNT_NAV_LINKS, isAccountNavActive } from '@/lib/account-nav';

export function AccountNav() {
  const pathname = usePathname();

  return (
    <nav className="space-y-3" aria-label="Collector dossier">
      {ACCOUNT_NAV_LINKS.map((link) => {
        const active = isAccountNavActive(pathname, link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? 'page' : undefined}
            className={active
              ? 'block label-md pl-3 -ml-3 border-l border-primary text-primary'
              : 'block label-md pl-3 -ml-3 border-l border-transparent text-on-surface-variant hover:text-primary'}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
