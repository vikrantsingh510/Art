import { isNavHrefActive } from './nav-active.js';

export const ADMIN_NAV_LINKS = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/settings', label: 'Settings' },
  { href: '/admin/artworks', label: 'Artwork collection' },
  { href: '/admin/artworks/new', label: 'Add new artwork' },
  { href: '/admin/blogs', label: 'Journal' },
  { href: '/admin/collections', label: 'Collections' },
  { href: '/admin/artists', label: 'Artists' },
  { href: '/admin/orders', label: 'Orders' },
  { href: '/admin/customers', label: 'Customers' },
];

export function isAdminNavActive(pathname, href) {
  return isNavHrefActive(
    pathname,
    href,
    ADMIN_NAV_LINKS.map((link) => link.href),
  );
}
