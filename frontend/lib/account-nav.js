import { isNavHrefActive } from './nav-active.js';

export const ACCOUNT_NAV_LINKS = [
  { href: '/account', label: 'Overview' },
  { href: '/account/profile', label: 'Profile' },
  { href: '/account/addresses', label: 'Addresses' },
  { href: '/account/wishlist', label: 'Wishlist' },
  { href: '/cart', label: 'Bag' },
  { href: '/account/orders', label: 'Orders' },
];

export function isAccountNavActive(pathname, href) {
  return isNavHrefActive(
    pathname,
    href,
    ACCOUNT_NAV_LINKS.map((link) => link.href),
  );
}
