'use client';

import Link from 'next/link';
import { useState } from 'react';
import { IconClose, IconMenu } from './icons';

const links = [
  { href: '/', label: 'Exhibition' },
  { href: '/explore', label: 'Explore Art' },
  { href: '/collections', label: 'Collections' },
  { href: '/journal', label: 'Journal' },
  { href: '/artists', label: 'Artists' },
  { href: '/about', label: 'Our Philosophy' },
  { href: '/contact', label: 'Inquiry' },
];

export function MobileNav({ user, cartCount = 0, wishlistCount = 0 }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="xl:hidden">
      <button type="button" aria-label={open ? 'Close menu' : 'Open menu'} onClick={() => setOpen((value) => !value)}>
        {open ? <IconClose /> : <IconMenu />}
      </button>
      {open ? (
        <div className="absolute left-0 right-0 top-full bg-surface border-b border-fillet px-6 py-6 space-y-4">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="label-md block text-on-surface" onClick={() => setOpen(false)}>
              {link.label}
            </Link>
          ))}
          <Link href="/account/wishlist" className="label-md block" onClick={() => setOpen(false)}>
            Wishlist{wishlistCount ? ` (${wishlistCount})` : ''}
          </Link>
          <Link href="/cart" className="label-md block" onClick={() => setOpen(false)}>
            Bag{cartCount ? ` (${cartCount})` : ''}
          </Link>
          <Link href={user ? '/account' : '/auth/login'} className="label-md block" onClick={() => setOpen(false)}>
            {user ? 'Dossier' : 'Sign in'}
          </Link>
          {user?.isAdmin ? (
            <Link href="/admin" className="label-md block" onClick={() => setOpen(false)}>
              Curatorial console
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
